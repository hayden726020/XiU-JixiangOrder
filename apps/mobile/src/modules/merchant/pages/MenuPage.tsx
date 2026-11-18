import { Fragment, useEffect, useRef, useState } from 'react';
import type {
  CreateDishInput,
  DailyMenuSelection,
  Dish,
  DishCustomization,
  DishCustomizationDraft,
  DishType,
  MenuDay,

  SourceResult,
  UploadedDishImage,
} from '../data/types';
import { createRequestId } from '../../../shared/requestId';
import DishCustomizeEditor from '../components/DishCustomizeEditor';
import DishCustomizePreview from '../components/DishCustomizePreview';
import DishThumb from '../components/DishThumb';
import {
  IconChevronUp,
  IconEye,
  IconEyeOff,
  IconListPlus,
  IconPencil,
  IconPlus,
  IconTrash2,
  IconUtensils,
} from '../components/MerchantIcons';
import {
  customizationBadge,
  customizationToDraft,
  emptyCustomizationDraft,
  hasCustomization,
  loadCustomizations,
  saveCustomizations,
  validateCustomizationDraft,
} from '../state/dishCustomization';
import { menuDateOptions } from '../state/menuView';
import {
  canEditVersion,
  menuWriteErrorText,
  parseDishPatch,
  type DishPatch,
} from '../state/menuEdit';
import { DISH_TYPE_OPTIONS, dishTypeLabel, validateNewDish } from '../state/onboarding';

import { formatYuan } from '../utils/money';

type DishFieldErrors = Partial<Record<'name' | 'type' | 'priceText' | 'quantityText', string>>;

interface MenuPageProps {
  dates: ReadonlyArray<string>;
  date: string;
  today: string;
  isSample: boolean;
  loading: boolean;
  error: string | null;
  initialTab?: 'today' | 'library';
  onDateChange: (date: string) => void;
  menu: MenuDay | null;
  onSaveDish: (dish: Dish, patch: DishPatch, requestId: string) => Promise<SourceResult<Dish>>;
  onCreateDish: (input: CreateDishInput) => Promise<SourceResult<Dish>>;
  onUploadDishImage: (dataUrl: string, requestId: string) => Promise<SourceResult<UploadedDishImage>>;
  onGoSetup: () => void;
  onDeleteDish: (dish: Dish, requestId: string) => Promise<SourceResult<{ dishId: string }>>;
  dishLibrary: ReadonlyArray<Dish>;
  dishLibraryLoading: boolean;
  dishLibraryError: string | null;
  onLoadDishLibrary: () => void;
  onSaveDailyMenu: (items: DailyMenuSelection[], requestId: string) => Promise<SourceResult<MenuDay>>;

}

function shortDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

export default function MenuPage({
  dates,
  date,
  today,
  isSample,
  loading,
  error,
  onDateChange,
  menu,
  onSaveDish,
  onCreateDish,
  onUploadDishImage,
  onDeleteDish,
  dishLibrary,
  dishLibraryLoading,
  dishLibraryError,
  onLoadDishLibrary,
  onSaveDailyMenu,

  initialTab = 'today',
  onGoSetup,
}: MenuPageProps) {
  const dateOptions = isSample
    ? dates.map((option, index) => ({
      date: option,
      label: `${index === 0 ? '演示日' : '演示次日'} ${shortDate(option)}`,
      isToday: index === 0,
    }))
    : menuDateOptions(dates, today);
  const dateIsToday = date === today;
  const dateTitle = dateIsToday ? '今日菜单' : `${shortDate(date)} 菜单`;
  const scope: 'sample' | 'real' = isSample ? 'sample' : 'real';
  const [customizations, setCustomizations] = useState<Record<string, DishCustomization>>(() => loadCustomizations(scope));
  const [dishCustomDraft, setDishCustomDraft] = useState<DishCustomizationDraft>(emptyCustomizationDraft);
  const [dishCustomError, setDishCustomError] = useState<string | null>(null);
  const [newDishCustomDraft, setNewDishCustomDraft] = useState<DishCustomizationDraft>(emptyCustomizationDraft);
  const [newDishCustomError, setNewDishCustomError] = useState<string | null>(null);
  const [customizationStoreError, setCustomizationStoreError] = useState<string | null>(null);
  const [menuTab, setMenuTab] = useState<'today' | 'library'>(initialTab);
  const [dailyMenuOpen, setDailyMenuOpen] = useState(false);
  const [dailyDraft, setDailyDraft] = useState<Record<string, { selected: boolean; quantityText: string }>>({});
  const [dailyRequestId, setDailyRequestId] = useState('');
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailySaving, setDailySaving] = useState(false);
  const [dailyConfirm, setDailyConfirm] = useState<string | null>(null);
  const [dailyDiscardConfirm, setDailyDiscardConfirm] = useState(false);
  const [dailyResult, setDailyResult] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishType, setDishType] = useState<DishType | ''>('STAPLE');
  const [dishPrice, setDishPrice] = useState('');
  const [dishQuantity, setDishQuantity] = useState('');
  const [dishOnSale, setDishOnSale] = useState(true);
  const [dishRequestId, setDishRequestId] = useState('');
  const [dishError, setDishError] = useState<string | null>(null);
  const [dishFieldErrors, setDishFieldErrors] = useState<DishFieldErrors>({});
  const [dishSaving, setDishSaving] = useState(false);
  const dishSavingRef = useRef(false);
  const [dishTogglingId, setDishTogglingId] = useState<string | null>(null);
  const [stockSavingId, setStockSavingId] = useState<string | null>(null);
  const [todayTogglingId, setTodayTogglingId] = useState<string | null>(null);
  const [todayToggleFeedback, setTodayToggleFeedback] = useState<{ dishId: string; message: string } | null>(null);
  const [dishToggleFeedback, setDishToggleFeedback] = useState<{ dishId: string; message: string } | null>(null);

  const [deleteDishId, setDeleteDishId] = useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState('');
  const [dishDeleteError, setDishDeleteError] = useState<string | null>(null);
  const [dishDeletingId, setDishDeletingId] = useState<string | null>(null);
  const [creatingDish, setCreatingDish] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishType, setNewDishType] = useState<DishType | ''>('STAPLE');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishQuantity, setNewDishQuantity] = useState('');
  const [newDishRequestId, setNewDishRequestId] = useState('');
  const [newDishError, setNewDishError] = useState<string | null>(null);
  const [newDishFieldErrors, setNewDishFieldErrors] = useState<DishFieldErrors>({});
  const [newDishSaving, setNewDishSaving] = useState(false);
  const newDishSavingRef = useRef(false);
  const [newDishNeedsShop, setNewDishNeedsShop] = useState(false);

  useEffect(() => {
    setCustomizations(loadCustomizations(scope));
  }, [scope]);

  useEffect(() => {
    setDailyMenuOpen(false);
    setDailyDraft({});
    setDailyRequestId('');
    setDailyError(null);
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
    setDailyResult(null);
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDishFieldErrors({});
    setDishCustomError(null);
    setDishCustomDraft(emptyCustomizationDraft());
    setCreatingDish(false);
    setNewDishRequestId('');
    setNewDishError(null);
    setNewDishFieldErrors({});
    setNewDishNeedsShop(false);
    setNewDishCustomDraft(emptyCustomizationDraft());
    setNewDishCustomError(null);
    setDeleteDishId(null);
    setDeleteRequestId('');
    setDishDeleteError(null);
    setDishToggleFeedback(null);
    setTodayToggleFeedback(null);
  }, [date, scope]);

  useEffect(() => {
    if (!editingDishId && !creatingDish) return;
    const selector = editingDishId ? '[data-dish-edit]' : '[data-dish-create-form]';
    const target = document.querySelector(selector);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingDishId, creatingDish]);

  useEffect(() => {
    if (!dailyMenuOpen) return;
    const target = document.querySelector('[data-daily-menu-editor]');
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [dailyMenuOpen]);

  function persistCustomizations(next: Record<string, DishCustomization>) {
    setCustomizations(next);
    setCustomizationStoreError(saveCustomizations(scope, next)
      ? null
      : '本机存储空间不足：图片和选项只保留在当前页面，刷新后会丢失。');
  }

  function priceFenFromText(text: string): number {
    const trimmed = text.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 0;
    const fen = Math.round(Number(trimmed) * 100);
    return Number.isSafeInteger(fen) && fen >= 0 ? fen : 0;
  }

  function clearDishFieldError(key: keyof DishFieldErrors) {
    setDishFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function clearNewDishFieldError(key: keyof DishFieldErrors) {
    setNewDishFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function customizationFor(dish: Dish): DishCustomization {
    return customizations[dish.dishId]
      ?? { imageUrl: dish.imageUrl, flavorGroups: [], sides: [], addOns: [] };
  }

  const dailyLibrary = (() => {
    const merged = new Map<string, Dish>();
    for (const dish of dishLibrary) {
      merged.set(dish.dishId, dish);
    }
    for (const dish of menu?.dishes ?? []) {
      merged.set(dish.dishId, dish);
    }
    return [...merged.values()];
  })();

  function todayDishFor(dish: Dish): Dish | null {
    return menu?.dishes.find((item) => item.dishId === dish.dishId) ?? null;
  }

  function dailyRow(dish: Dish): { selected: boolean; quantityText: string } {
    const draft = dailyDraft[dish.dishId];
    if (draft) return draft;
    const todayDish = todayDishFor(dish);
    return {
      selected: Boolean(todayDish?.onSale),
      quantityText: String(todayDish?.availableQuantity ?? dish.availableQuantity),
    };
  }

  function updateDailyRow(dish: Dish, patch: Partial<{ selected: boolean; quantityText: string }>) {
    setDailyDraft((current) => ({
      ...current,
      [dish.dishId]: { ...(current[dish.dishId] ?? dailyRow(dish)), ...patch },
    }));
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
    setDailyResult(null);
  }

  function dailyChangeSummary(): string {
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const dish of dailyLibrary) {
      const row = dailyRow(dish);
      const original = todayDishFor(dish);
      if (row.selected && (!original || !original.onSale)) {
        added += 1;
      } else if (!row.selected && original?.onSale) {
        removed += 1;
      } else if (row.selected && original) {
        const text = row.quantityText.trim();
        if (!/^\d+$/.test(text) || Number(text) !== original.availableQuantity) {
          changed += 1;
        }
      }
    }
    if (added === 0 && removed === 0 && changed === 0) return '未修改';
    return `新增上架 ${added} 道 · 取消上架 ${removed} 道 · 调整库存 ${changed} 道`;
  }

  function collectDailyItems(): DailyMenuSelection[] | null {
    const items: DailyMenuSelection[] = [];
    for (const dish of dailyLibrary) {
      const row = dailyRow(dish);
      const original = todayDishFor(dish);
      const keepOffSale = !row.selected && original !== null && !original.onSale;
      if (!row.selected && !keepOffSale) continue;
      const text = (row.selected ? row.quantityText : String(original?.availableQuantity ?? 0)).trim();
      if (!/^\d+$/.test(text)) {
        setDailyError(`「${dish.name}」的今日库存必须是 0 或正整数。`);
        return null;
      }
      const quantity = Number(text);
      if (!Number.isSafeInteger(quantity) || quantity > 10_000) {
        setDailyError(`「${dish.name}」的今日库存不能超过 10000。`);
        return null;
      }
      items.push({ dishId: dish.dishId, availableQuantity: quantity });
    }
    return items;
  }

  function switchMenuTab(next: 'today' | 'library') {
    setMenuTab(next);
    if (next === 'library' && isSample) {
      onLoadDishLibrary();
    }
  }

  async function toggleDishInToday(dish: Dish) {
    if (!isSample || todayTogglingId !== null || dailySaving) return;
    const current = menu?.dishes ?? [];
    const exists = current.some((item) => item.dishId === dish.dishId);
    const rows: DailyMenuSelection[] = current.map((item) => ({
      dishId: item.dishId,
      availableQuantity: item.availableQuantity,
    }));
    const items = exists
      ? rows.filter((item) => item.dishId !== dish.dishId)
      : [...rows, { dishId: dish.dishId, availableQuantity: dish.availableQuantity }];
    setTodayTogglingId(dish.dishId);
    setTodayToggleFeedback(null);
    const result = await onSaveDailyMenu(items, createRequestId('merchant-daily-menu'));
    setTodayTogglingId(null);
    if (!result.ok) {
      setTodayToggleFeedback({
        dishId: dish.dishId,
        message: menuWriteErrorText(result.error.code, result.error.message),
      });
      return;
    }
    setDailyResult(exists
      ? `已把「${dish.name}」移出「${shortDate(date)}」的今日菜单，菜品库仍保留这道菜。`
      : `已把「${dish.name}」加入「${shortDate(date)}」的今日菜单，库存 ${dish.availableQuantity}。`);
  }

  function startDailyMenuEdit() {
    if (!isSample) return;
    setDailyMenuOpen(true);
    setDailyDraft({});
    setDailyRequestId(createRequestId('merchant-daily-menu'));
    setDailyError(null);
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
    setDailyResult(null);
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDishCustomError(null);
    setCreatingDish(false);
    setNewDishRequestId('');
    setNewDishError(null);
    setNewDishCustomError(null);
    setNewDishNeedsShop(false);
    setDeleteDishId(null);
    setDishDeleteError(null);
    onLoadDishLibrary();
  }

  function cancelDailyMenuEdit() {
    if (dailySaving) return;
    setDailyMenuOpen(false);
    setDailyDraft({});
    setDailyRequestId('');
    setDailyError(null);
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
  }

  function requestCancelDailyMenu() {
    if (dailySaving) return;
    if (dailyChangeSummary() !== '未修改') {
      setDailyDiscardConfirm(true);
      return;
    }
    cancelDailyMenuEdit();
  }

  function requestDailySave() {
    if (dailySaving || dishLibraryLoading || dishLibraryError) return;
    const items = collectDailyItems();
    if (!items) return;
    const summary = dailyChangeSummary();
    setDailyError(null);
    if (summary === '未修改') {
      setDailyResult(`「${shortDate(date)}」的今日菜单与已保存内容一致，没有需要保存的改动。`);
      return;
    }
    setDailyConfirm(`${summary}。保存后只更新 ${shortDate(date)} 的菜单与库存，其他日期不受影响。`);
  }

  async function confirmDailySave() {
    const items = collectDailyItems();
    setDailyConfirm(null);
    if (!items) return;
    await submitDailyMenu(items);
  }

  async function submitDailyMenu(items: DailyMenuSelection[]) {
    const requestId = dailyRequestId || createRequestId('merchant-daily-menu');
    setDailyRequestId(requestId);
    setDailySaving(true);
    setDailyError(null);
    const result = await onSaveDailyMenu(items, requestId);
    setDailySaving(false);
    if (result.ok) {
      setDailyMenuOpen(false);
      setDailyDraft({});
      setDailyRequestId('');
      setDailyResult(isSample
        ? `已更新「${shortDate(date)}」的今日菜单：上架 ${result.data.dishes.filter((item) => item.onSale).length} 道菜。样例改动只保存在当前页面内存，刷新后会还原。`
        : `已保存「${shortDate(date)}」的今日菜单：上架 ${result.data.dishes.filter((item) => item.onSale).length} 道菜，服务端已返回最新菜单。`);
      return;
    }
    setDailyError(menuWriteErrorText(result.error.code, result.error.message));
  }

  const dishVersionMissing = !isSample && (menu?.dishes.some((dish) => !canEditVersion(dish.version)) ?? false);
  const todayDishes = menu?.dishes ?? [];
  const todayOnSaleDishes = todayDishes.filter((dish) => dish.onSale);
  const todayOffSaleCount = todayDishes.length - todayOnSaleDishes.length;

  const dailyOnSaleCount = dailyLibrary.filter((dish) => dailyRow(dish).selected).length;
  const dailySortedLibrary = [...dailyLibrary].sort((a, b) => {
    const aOn = dailyRow(a).selected ? 0 : 1;
    const bOn = dailyRow(b).selected ? 0 : 1;
    return aOn - bOn;
  });
  const libraryOnSaleCount = dailyLibrary.filter((dish) => todayDishFor(dish)?.onSale).length;
  const librarySortedDishes = [...dailyLibrary].sort((a, b) => {
    const aOn = todayDishFor(a)?.onSale ? 0 : 1;
    const bOn = todayDishFor(b)?.onSale ? 0 : 1;
    return aOn - bOn;
  });

  function startDishEdit(dish: Dish) {
    setDailyMenuOpen(false);
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
    setEditingDishId(dish.dishId);
    setDishName(dish.name);
    setDishType(dish.type ?? 'STAPLE');
    setDishPrice((dish.unitPriceFen / 100).toFixed(2));
    setDishQuantity(String(dish.availableQuantity));
    setDishOnSale(dish.onSale);
    setDishRequestId(createRequestId('merchant-dish'));
    setDishError(null);
    setDishFieldErrors({});
    setDishCustomDraft(customizationToDraft(customizationFor(dish)));
    setDishCustomError(null);
    setDeleteDishId(null);
    setDishDeleteError(null);
    setDailyResult(null);
  }

  function cancelDishEdit() {
    if (dishSaving) return;
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDishFieldErrors({});
    setDishCustomError(null);
  }

  async function uploadImageForSave(
    imageUrl: string | null,
  ): Promise<{ ok: true; imageUrl: string | null } | { ok: false; error: string }> {
    if (!imageUrl || !imageUrl.startsWith('data:') || isSample) {
      return { ok: true, imageUrl };
    }
    const uploaded = await onUploadDishImage(imageUrl, createRequestId('merchant-image'));
    if (!uploaded.ok) {
      return { ok: false, error: menuWriteErrorText(uploaded.error.code, uploaded.error.message) };
    }
    return { ok: true, imageUrl: uploaded.data.imageUrl };
  }

  async function submitDish(dish: Dish) {
    if (dishSavingRef.current) return;
    const parsed = parseDishPatch(dishName, dishType, dishPrice, dishQuantity, dishOnSale);
    if (!parsed.ok) {
      setDishFieldErrors({ [parsed.field]: parsed.error });
      setDishError(null);
      return;
    }
    setDishFieldErrors({});
    const custom = validateCustomizationDraft(dishCustomDraft);
    if (!custom.ok) {
      setDishCustomError(custom.error);
      return;
    }
    setDishCustomError(null);
    const requestId = dishRequestId || createRequestId('merchant-dish');
    setDishRequestId(requestId);
    dishSavingRef.current = true;
    setDishSaving(true);
    setDishError(null);
    let imageUrlForSave: string | null | undefined;
    if (customizations[dish.dishId] !== undefined) {
      const image = await uploadImageForSave(custom.value.imageUrl);
      if (!image.ok) {
        dishSavingRef.current = false;
        setDishSaving(false);
        setDishCustomError(image.error);
        return;
      }
      imageUrlForSave = image.imageUrl;
    }
    const result = await onSaveDish(dish, { ...parsed.patch, imageUrl: imageUrlForSave }, requestId);
    dishSavingRef.current = false;
    setDishSaving(false);
    if (result.ok) {
      const nextCustom = { ...custom.value, imageUrl: isSample ? custom.value.imageUrl : null };
      if (hasCustomization(nextCustom)) {
        persistCustomizations({ ...customizations, [dish.dishId]: nextCustom });
      } else {
        persistCustomizations(Object.fromEntries(
          Object.entries(customizations).filter(([dishId]) => dishId !== dish.dishId),
        ));
      }
      setEditingDishId(null);
      setDishFieldErrors({});
      setDishRequestId('');
      return;
    }
    setDishError(menuWriteErrorText(result.error.code, result.error.message));
  }

  async function toggleDishSale(dish: Dish) {
    if (dishTogglingId !== null) return;
    setDishTogglingId(dish.dishId);
    setDishToggleFeedback(null);
    const patch: DishPatch = {
      name: dish.name,
      type: dish.type ?? 'STAPLE',
      priceFen: dish.unitPriceFen,
      availableQuantity: dish.availableQuantity,
      onSale: !dish.onSale,
      imageUrl: dish.imageUrl,
    };
    const result = await onSaveDish(dish, patch, createRequestId('merchant-dish-sale'));
    setDishTogglingId(null);
    if (!result.ok) {
      setDishToggleFeedback({
        dishId: dish.dishId,
        message: menuWriteErrorText(result.error.code, result.error.message),
      });
    }
  }

  async function adjustStock(dish: Dish, delta: number) {
    if (stockSavingId !== null || dishTogglingId !== null) return;
    const next = dish.availableQuantity + delta;
    if (!Number.isInteger(next) || next < 0 || next > 10_000) {
      setDishToggleFeedback({
        dishId: dish.dishId,
        message: '库存必须是 0—10000 的整数。',
      });
      return;
    }
    setStockSavingId(dish.dishId);
    setDishToggleFeedback(null);
    setDailyResult(null);
    const patch: DishPatch = {
      name: dish.name,
      type: dish.type ?? 'STAPLE',
      priceFen: dish.unitPriceFen,
      availableQuantity: next,
      onSale: dish.onSale,
      imageUrl: dish.imageUrl,
    };
    const result = await onSaveDish(dish, patch, createRequestId('merchant-dish-stock'));
    setStockSavingId(null);
    if (!result.ok) {
      setDishToggleFeedback({
        dishId: dish.dishId,
        message: menuWriteErrorText(result.error.code, result.error.message),
      });
      return;
    }
    setDailyResult(result.data.availableQuantity === 0
      ? `「${result.data.name}」库存已调整为 0，学生端会显示售罄；已确认的预约订单不受影响。`
      : `「${result.data.name}」库存已更新为 ${result.data.availableQuantity}（${shortDate(date)}），已确认的预约订单不受影响。`);
  }

  function startCreateDish() {
    setDailyMenuOpen(false);
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
    setCreatingDish(true);
    setNewDishName('');
    setNewDishType('STAPLE');
    setNewDishPrice('');
    setNewDishQuantity('');
    setNewDishRequestId(createRequestId('merchant-dish-create'));
    setNewDishError(null);
    setNewDishFieldErrors({});
    setNewDishNeedsShop(false);
    setNewDishCustomDraft(emptyCustomizationDraft());
    setNewDishCustomError(null);
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDishCustomError(null);
    setDeleteDishId(null);
    setDishDeleteError(null);
    setDailyResult(null);
  }

  function cancelCreateDish() {
    if (newDishSaving) return;
    setCreatingDish(false);
    setNewDishRequestId('');
    setNewDishError(null);
    setNewDishFieldErrors({});
    setNewDishNeedsShop(false);
    setNewDishCustomDraft(emptyCustomizationDraft());
    setNewDishCustomError(null);
  }

  async function submitCreateDish() {
    if (newDishSavingRef.current) return;
    const parsed = validateNewDish({
      type: newDishType,
      name: newDishName,
      priceText: newDishPrice,
      quantityText: newDishQuantity,
    });
    if (!parsed.ok) {
      setNewDishFieldErrors(parsed.errors as DishFieldErrors);
      setNewDishError(null);
      return;
    }
    setNewDishFieldErrors({});
    const custom = validateCustomizationDraft(newDishCustomDraft);
    if (!custom.ok) {
      setNewDishCustomError(custom.error);
      return;
    }
    setNewDishCustomError(null);
    const requestId = newDishRequestId || createRequestId('merchant-dish-create');
    setNewDishRequestId(requestId);
    newDishSavingRef.current = true;
    setNewDishSaving(true);
    setNewDishError(null);
    setNewDishNeedsShop(false);
    let imageUrlForSave: string | null | undefined;
    if (custom.value.imageUrl) {
      const image = await uploadImageForSave(custom.value.imageUrl);
      if (!image.ok) {
        newDishSavingRef.current = false;
        setNewDishSaving(false);
        setNewDishCustomError(image.error);
        return;
      }
      imageUrlForSave = image.imageUrl;
    }
    const result = await onCreateDish({ requestId, ...parsed.value, imageUrl: imageUrlForSave });
    newDishSavingRef.current = false;
    setNewDishSaving(false);
    if (result.ok) {
      const nextCustom = { ...custom.value, imageUrl: isSample ? custom.value.imageUrl : null };
      if (hasCustomization(nextCustom)) {
        persistCustomizations({ ...customizations, [result.data.dishId]: nextCustom });
      }
      setCreatingDish(false);
      setNewDishFieldErrors({});
      setNewDishRequestId('');
      setNewDishName('');
      setNewDishPrice('');
      setNewDishQuantity('');
      setNewDishCustomDraft(emptyCustomizationDraft());
      setNewDishCustomError(null);
      setDailyResult(`已新增菜品「${result.data.name}」，并加入「${shortDate(date)}」的菜单；其他日期不会自动上架。`);
      return;
    }
    setNewDishError(menuWriteErrorText(result.error.code, result.error.message));
    setNewDishNeedsShop(
      result.error.code === 'SHOP_REQUIRED'
      || result.error.code === 'MERCHANT_REQUIRED'
      || result.error.code === 'MERCHANT_NOT_REGISTERED',
    );
  }

  function askDeleteDish(dish: Dish) {
    if (dishDeletingId !== null) return;
    setDeleteDishId(dish.dishId);
    setDeleteRequestId(createRequestId('merchant-dish-delete'));
    setDishDeleteError(null);
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDailyMenuOpen(false);
    setDailyConfirm(null);
    setDailyDiscardConfirm(false);
  }

  function cancelDeleteDish() {
    if (dishDeletingId !== null) return;
    setDeleteDishId(null);
    setDeleteRequestId('');
    setDishDeleteError(null);
  }

  async function submitDeleteDish(dish: Dish) {
    const requestId = deleteRequestId || createRequestId('merchant-dish-delete');
    setDeleteRequestId(requestId);
    setDishDeletingId(dish.dishId);
    setDishDeleteError(null);
    const result = await onDeleteDish(dish, requestId);
    setDishDeletingId(null);
    if (result.ok) {
      persistCustomizations(Object.fromEntries(
        Object.entries(customizations).filter(([dishId]) => dishId !== result.data.dishId),
      ));
      setDeleteDishId(null);
      setDeleteRequestId('');
      if (dailyMenuOpen) onLoadDishLibrary();
      return;
    }
    setDishDeleteError(menuWriteErrorText(result.error.code, result.error.message));
  }

  const dailySummary = dailyChangeSummary();
  const editingDish = editingDishId
    ? menu?.dishes.find((item) => item.dishId === editingDishId)
      ?? dailyLibrary.find((item) => item.dishId === editingDishId)
      ?? null
    : null;
  const deletingDish = deleteDishId
    ? menu?.dishes.find((item) => item.dishId === deleteDishId)
      ?? dailyLibrary.find((item) => item.dishId === deleteDishId)
      ?? null
    : null;

  return (
    <div className="merchant-view merchant-menu-page" data-menu-mode={isSample ? 'sample' : 'real'}>
      <header className="menu-page__head">
        <div className="menu-page__head-copy">
          <h2>
            菜单与库存
            <span className="merchant-readonly-tag">
              {isSample ? '样例演示' : '真实 · 演示服务'}
            </span>
          </h2>
          <p className="lead">
            {isSample
              ? '样例数据：菜品与库存的修改只写入当前页面内存，不发送真实请求。'
              : '菜品与库存来自 GET /menu；保存结果以服务端返回为准。'}
          </p>
          <p className="menu-page__date-note">
            当前查看：{isSample ? `演示日 ${shortDate(date)}` : shortDate(date)}
            {isSample ? '（样例日期固定，不对应真实今天）' : ''}
          </p>
        </div>
        <div className="menu-page__actions">
          {menuTab === 'today' && (
            <button
              type="button"
              className="action-button"
              onClick={startDailyMenuEdit}
              disabled={!isSample || dailySaving || creatingDish || editingDishId !== null || dishDeletingId !== null}
              title={!isSample ? '真实服务暂未提供菜品库与每日菜单接口，当前仅样例模式可选择今日菜单' : undefined}
data-open-daily-menu
            >
              <IconListPlus size={15} />
              从菜品库选今日菜品
            </button>
          )}
          <button
            type="button"
            className="action-button action-button--primary"
            onClick={startCreateDish}
            disabled={creatingDish || newDishSaving}
            title={`新增菜品会加入 ${shortDate(date)} 的菜单，其他日期不受影响`}
            data-dish-create
          >
            <IconPlus size={15} />
            新增菜品
          </button>
        </div>
      </header>

      <div className="menu-tabs" role="tablist" aria-label="菜单分区">
        <button
          type="button"
          role="tab"
          aria-selected={menuTab === 'today'}
          className={menuTab === 'today' ? 'menu-tabs__button menu-tabs__button--active' : 'menu-tabs__button'}
          onClick={() => switchMenuTab('today')}
          data-menu-tab="today"
          title={dateIsToday ? undefined : `当前选择 ${shortDate(date)}，不是今天`}
        >
          今日菜单
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={menuTab === 'library'}
          className={menuTab === 'library' ? 'menu-tabs__button menu-tabs__button--active' : 'menu-tabs__button'}
          onClick={() => switchMenuTab('library')}
          data-menu-tab="library"
        >
          菜品 · 总菜单
        </button>
      </div>

      {dishVersionMissing && (
        <p className="hint menu-page__version-warning" data-menu-version-missing>
          服务端 GET /menu 未返回 dish.version，编辑与删除按钮已禁用；已记录给后端补字段。
        </p>
      )}

      {menuTab === 'today' && (
        <div className="date-switch" role="tablist" aria-label="菜单日期">
          {dateOptions.map((option) => (
            <button
              key={option.date}
              type="button"
              role="tab"
              aria-selected={option.date === date}
              className={option.date === date ? 'date-switch__button date-switch__button--active' : 'date-switch__button'}
              onClick={() => onDateChange(option.date)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {dailyResult && (
        <div className="menu-page__feedback" role="status">
          <span>{dailyResult}</span>
          <button type="button" className="menu-page__feedback-close" onClick={() => setDailyResult(null)}>
            关闭
          </button>
        </div>
      )}

      {loading ? (
        <p className="merchant-empty">正在读取菜单…</p>
      ) : error ? (
        <p className="merchant-empty">菜单读取失败：{error}</p>
      ) : !menu ? (
        <p className="merchant-empty">这一天没有数据。</p>
      ) : (
        <>

          {menuTab === 'today' && (
          <section className="menu-card" aria-label="今日菜单">
            <header className="menu-card__head">
              <div>
                <h3>{dateTitle}</h3>
                <p>{dateIsToday ? '今日' : shortDate(date)}在售 {todayOnSaleDishes.length} 道 · {isSample ? `演示日 ${shortDate(date)}` : shortDate(date)}</p>
              </div>
              <span className="menu-card__hint">{isSample ? '当天在售 · 学生端可见' : '真实数据'}</span>
            </header>
            {todayOffSaleCount > 0 && (
              <p className="hint menu-card__off-sale" data-off-sale-note>
                {todayOffSaleCount} 道已下架的菜已从今日菜单隐藏。
                <button
                  type="button"
                  className="menu-card__off-sale-link"
                  onClick={() => switchMenuTab('library')}
                >
                  去菜品 · 总菜单重新上架
                </button>
              </p>
            )}
            {todayOnSaleDishes.length === 0 ? (
              <div className="menu-card__empty menu-card__empty--action">
                <IconUtensils size={26} />
                <p>
                  {todayOffSaleCount > 0
                    ? '今日菜单里的菜都已下架，去「菜品 · 总菜单」重新上架后会回到今日菜单。'
                    : '今天还没有上架菜品，去「菜品 · 总菜单」里勾选今天要卖的菜即可。'}
                </p>
                <button type="button" className="action-button" onClick={() => switchMenuTab('library')}>
                  去菜品 · 总菜单
                </button>
              </div>
            ) : (

              <ul className="menu-list">
                {todayOnSaleDishes.map((dish) => {
                  const custom = customizations[dish.dishId];
                  const badge = customizationBadge(custom);
                  const imageUrl = custom?.imageUrl ?? dish.imageUrl;
                  return (
                    <li
                      key={dish.dishId}
                      className={[
                        'menu-item',
                        dish.availableQuantity === 0 ? 'menu-item--soldout' : '',
                      ].filter(Boolean).join(' ')}
                      data-dish-id={dish.dishId}
                      data-dish-version={dish.version ?? 'missing'}
                    >
                      <DishThumb src={imageUrl} alt={`${dish.name} 图片`} />
                      <span className="menu-item__info">
                        <span className="menu-item__name">
                          {dish.name}
                          {badge && <span className="menu-badge menu-badge--soft">{badge}</span>}
                        </span>
                        <span className="menu-item__meta">
                          <span>{dish.type ? dishTypeLabel(dish.type) : '未分类'}</span>
                          <span className="menu-item__price">{formatYuan(dish.unitPriceFen)}</span>
                        </span>
                        <span className="menu-item__stock-line">
                          {dish.availableQuantity === 0 ? (
                            <span className="menu-badge menu-badge--soldout">已售罄</span>
                          ) : (
                            <span className="menu-badge menu-badge--on">在售</span>
                          )}
                          <span className={`menu-item__qty${dish.availableQuantity === 0 ? ' is-soldout' : dish.availableQuantity <= 5 ? ' is-low' : ''}`}>
                            库存 {dish.availableQuantity}
                            {dish.availableQuantity > 0 && dish.availableQuantity <= 5 && (
                              <span className="menu-item__stock-warning">偏低</span>
                            )}
                          </span>
                          <span className="menu-item__stock-edit">
                            <button
                              type="button"
                              aria-label={`减少 ${dish.name} 库存`}
                              onClick={() => void adjustStock(dish, -1)}
                              disabled={
                                !canEditVersion(dish.version)
                                || stockSavingId !== null
                                || dishSaving
                                || dishTogglingId !== null
                                || dishDeletingId !== null
                                || editingDishId === dish.dishId
                                || dish.availableQuantity <= 0
                              }
                            >
                              −
                            </button>
                            <button
                              type="button"
                              aria-label={`增加 ${dish.name} 库存`}
                              onClick={() => void adjustStock(dish, 1)}
                              disabled={
                                !canEditVersion(dish.version)
                                || stockSavingId !== null
                                || dishSaving
                                || dishTogglingId !== null
                                || dishDeletingId !== null
                                || editingDishId === dish.dishId
                                || dish.availableQuantity >= 10_000
                              }
                              aria-busy={stockSavingId === dish.dishId || undefined}
                            >
                              {stockSavingId === dish.dishId ? '…' : '＋'}
                            </button>
                          </span>
                          <span className="menu-item__version">
                            {canEditVersion(dish.version) ? `v${dish.version}` : 'version 未返回'}
                          </span>
                        </span>
                      </span>
                      <span className="menu-item__actions">
                        <button
                          type="button"
                          className="menu-item__sale-toggle"
                          onClick={() => void toggleDishSale(dish)}
                          disabled={
                            !canEditVersion(dish.version)
                            || dishSaving
                            || dishDeletingId !== null
                            || dishTogglingId !== null
                            || editingDishId === dish.dishId
                          }
                          aria-busy={dishTogglingId === dish.dishId || undefined}
                        >
                          {dishTogglingId === dish.dishId ? '保存中…' : dish.onSale ? (
                            <>
                              <IconEyeOff size={13} />
                              下架
                            </>
                          ) : (
                            <>
                              <IconEye size={13} />
                              上架
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="menu-item__edit"
                          onClick={() => startDishEdit(dish)}
                          disabled={
                            !canEditVersion(dish.version)
                            || dishSaving
                            || dishDeletingId !== null
                            || editingDishId === dish.dishId
                          }
                        >
                          {editingDishId === dish.dishId ? '编辑中' : (
                            <>
                              <IconPencil size={13} />
                              编辑
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="menu-item__delete"
                          data-dish-delete={dish.dishId}
                          aria-label={`删除菜品 ${dish.name}`}
                          onClick={() => askDeleteDish(dish)}
                          disabled={
                            !canEditVersion(dish.version)
                            || dishSaving
                            || dishDeletingId !== null
                            || editingDishId === dish.dishId
                          }
                        >
                          <IconTrash2 size={13} />
                          删除
                        </button>
                      </span>
                      {dishToggleFeedback?.dishId === dish.dishId && (
                        <p className="action-feedback action-feedback--error menu-item__feedback" role="alert">
                          {dishToggleFeedback.message}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          )}

          {menuTab === 'today' && dailyMenuOpen && (
            <section className="daily-menu" data-daily-menu-editor aria-label="从菜品库选今日菜品">
              <header className="daily-menu__head">
                <div>
                  <h3>从菜品库选今日菜品</h3>
                  <p>
                    {isSample ? `演示日 ${shortDate(date)}` : shortDate(date)}
                    · 勾选今天要卖的菜并设置今日库存；已下架的菜请在「菜品 · 总菜单」重新上架。
                  </p>
                </div>
                <span className="daily-menu__count">库内 {dailyLibrary.length} 道</span>
              </header>
              {dishLibraryLoading && <p className="hint">正在读取菜品库…</p>}
              {dishLibraryError && (
                <p className="action-feedback action-feedback--error" role="alert" data-daily-menu-error>
                  {dishLibraryError}
                </p>
              )}
              {!dishLibraryLoading && !dishLibraryError && dailyLibrary.length === 0 && (
                <div className="menu-card__empty menu-card__empty--state">
                  <IconUtensils size={24} />
                  <p>菜品库还是空的，先新增一道菜品。</p>
                </div>
              )}
              {dailyLibrary.length > 0 && (
                <ul className="daily-menu__list">
                  {dailySortedLibrary.map((dish, index) => {
                    const row = dailyRow(dish);
                    const todayDish = todayDishFor(dish);
                    const offSaleToday = todayDish !== null && !todayDish.onSale;
                    const checked = row.selected && !offSaleToday;
                    const custom = customizations[dish.dishId];
                    const imageUrl = custom?.imageUrl ?? dish.imageUrl;
                    const qtyText = row.quantityText.trim();
                    const soldOut = checked && /^\d+$/.test(qtyText) && Number(qtyText) === 0;
                    return (
                      <Fragment key={dish.dishId}>
                        {index === 0 && (
                          <li className="daily-menu__group">今日已上架 {dailyOnSaleCount} 道</li>
                        )}
                        {index === dailyOnSaleCount && (
                          <li className="daily-menu__group">
                            今日未上架 {dailyLibrary.length - dailyOnSaleCount} 道
                          </li>
                        )}
                        <li
                          className={checked ? 'daily-menu__item is-on' : 'daily-menu__item'}
                          data-daily-dish={dish.dishId}
                        >
                          <label className="daily-menu__check">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={offSaleToday}
                              onChange={(event) => updateDailyRow(dish, { selected: event.target.checked })}
                              aria-label={offSaleToday
                                ? `${dish.name} 今日已下架，请到菜品总菜单重新上架`
                                : `今天上架 ${dish.name}`}
                            />
                            <span>{checked ? '上架' : '不上架'}</span>
                          </label>
                          <DishThumb size="sm" src={imageUrl} alt="" />
                          <span className="daily-menu__info">
                            <strong>{dish.name}</strong>
                            <span>
                              {dish.type ? dishTypeLabel(dish.type) : '未分类'} · {formatYuan(dish.unitPriceFen)}
                            </span>
                          </span>
                          <span className="daily-menu__state">
                            {offSaleToday ? (
                              <span className="menu-badge menu-badge--off">今日已下架</span>
                            ) : !checked ? (
                              <span className="menu-badge">今日未上架</span>
                            ) : soldOut ? (
                              <span className="menu-badge menu-badge--soldout">售罄</span>
                            ) : (
                              <span className="menu-badge menu-badge--on">今日已上架</span>
                            )}
                          </span>
                          <label className="daily-menu__qty">
                            <span>今日库存</span>
                            <input
                              value={row.quantityText}
                              inputMode="numeric"
                              disabled={!checked}
                              onChange={(event) => updateDailyRow(dish, { quantityText: event.target.value })}
                              aria-label={`${dish.name} 今日库存`}
                            />
                          </label>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              )}
              <footer className="daily-menu__footer">
                <span className="daily-menu__summary">
                  本次修改：{dailySummary}
                </span>
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--primary"
                    onClick={requestDailySave}
                    disabled={dailySaving || dishLibraryLoading || Boolean(dishLibraryError)}
                    aria-busy={dailySaving || undefined}
                    data-daily-menu-save
                  >
                    {dailySaving ? '保存中…' : '保存今日菜单'}
                  </button>
                  <button
                    type="button"
                    className="action-button"
                    onClick={requestCancelDailyMenu}
                    disabled={dailySaving}
                  >
                    取消
                  </button>
                </div>
              </footer>
              {dailyConfirm && (
                <div className="daily-menu__confirm" role="status">
                  <p><strong>确认保存：</strong>{dailyConfirm}</p>
                  <div className="action-bar">
                    <button
                      type="button"
                      className="action-button action-button--primary"
                      onClick={() => void confirmDailySave()}
                      disabled={dailySaving}
                      data-daily-menu-confirm
                    >
                      {dailySaving ? '保存中…' : '确认保存'}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => setDailyConfirm(null)}
                      disabled={dailySaving}
                    >
                      继续编辑
                    </button>
                  </div>
                </div>
              )}
              {dailyDiscardConfirm && (
                <div className="daily-menu__confirm is-warn" role="alert">
                  <p><strong>放弃未保存的修改？</strong>关闭后本次勾选与库存调整会丢失，其他日期不受影响。</p>
                  <div className="action-bar">
                    <button
                      type="button"
                      className="action-button action-button--danger"
                      onClick={() => {
                        setDailyDiscardConfirm(false);
                        cancelDailyMenuEdit();
                      }}
                    >
                      放弃修改
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => setDailyDiscardConfirm(false)}
                    >
                      继续编辑
                    </button>
                  </div>
                </div>
              )}
              {dailyError && (
                <p className="action-feedback action-feedback--error" role="alert" data-daily-menu-error>
                  {dailyError}
                </p>
              )}
            </section>
          )}

          {menuTab === 'library' && (
            <section className="menu-card" aria-label="菜品总菜单" data-menu-library>
              <header className="menu-card__head">
                <div>
                  <h3>菜品 · 总菜单</h3>
                  <p>库内共 {dailyLibrary.length} 道 · 今日在售 {todayOnSaleDishes.length} 道</p>
                </div>
                <span className="menu-card__hint">
                  {isSample ? '菜品库 · 跨日期共用' : '当前日期已上架'}
                </span>
              </header>
              {!isSample && (
                <p className="hint">
                  真实服务暂未提供菜品库接口，这里只展示当前日期已上架的菜品；价格与库存请在「今日菜单」里编辑。
                </p>
              )}
              {dishLibraryLoading && <p className="hint">正在读取菜品库…</p>}
              {dishLibraryError && isSample && (
                <p className="action-feedback action-feedback--error" role="alert" data-daily-menu-error>
                  {dishLibraryError}
                </p>
              )}
              {dailyLibrary.length === 0 ? (
                <div className="menu-card__empty menu-card__empty--state">
                  <IconUtensils size={24} />
                  <p>菜品库还是空的，先新增一道菜品。</p>
                </div>
              ) : (
                <ul className="menu-list">
                  {librarySortedDishes.map((dish, index) => {
                    const custom = customizations[dish.dishId];
                    const badge = customizationBadge(custom);
                    const imageUrl = custom?.imageUrl ?? dish.imageUrl;
                    const todayDish = todayDishFor(dish);
                    const inToday = todayDish !== null;
                    const offSaleToday = todayDish !== null && !todayDish.onSale;
                    const displayDish = todayDish ?? dish;
                    return (
                      <Fragment key={dish.dishId}>
                        {index === 0 && (
                          <li className="menu-list__group">今日已上架 {libraryOnSaleCount} 道</li>
                        )}
                        {index === libraryOnSaleCount && (
                          <li className="menu-list__group">
                            今日未上架 {dailyLibrary.length - libraryOnSaleCount} 道
                          </li>
                        )}
                        <li
                          className={inToday && !offSaleToday ? 'menu-item' : 'menu-item menu-item--off'}
                          data-library-dish={dish.dishId}
                          data-dish-version={displayDish.version ?? 'missing'}
                        >
                        <DishThumb src={imageUrl} alt={`${displayDish.name} 图片`} />
                        <span className="menu-item__info">
                          <span className="menu-item__name">
                            {displayDish.name}
                            {badge && <span className="menu-badge menu-badge--soft">{badge}</span>}
                          </span>
                          <span className="menu-item__meta">
                            <span>{displayDish.type ? dishTypeLabel(displayDish.type) : '未分类'}</span>
                            <span className="menu-item__price">{formatYuan(displayDish.unitPriceFen)}</span>
                          </span>
                          <span className="menu-item__stock-line">
                            <span className={offSaleToday ? 'menu-badge menu-badge--off' : inToday ? 'menu-badge menu-badge--on' : 'menu-badge'}>
                              {offSaleToday ? '今日已下架' : inToday ? '今日已上架' : '今日未上架'}
                            </span>
                            {todayDish ? (
                              <span className={`menu-item__qty${todayDish.availableQuantity === 0 ? ' is-soldout' : ''}`}>
                                今日库存 {todayDish.availableQuantity}
                              </span>
                            ) : (
                              <span className="menu-item__version">库内库存 {dish.availableQuantity}</span>
                            )}
                          </span>
                        </span>
                        <span className="menu-item__actions">
                          {offSaleToday ? (
                            <button
                              type="button"
                              className="menu-item__sale-toggle"
                              onClick={() => void toggleDishSale(displayDish)}
                              disabled={
                                !canEditVersion(displayDish.version)
                                || dishSaving
                                || dishDeletingId !== null
                                || dishTogglingId !== null
                                || editingDishId === dish.dishId
                              }
                              aria-busy={dishTogglingId === dish.dishId || undefined}
                              data-dish-restore={dish.dishId}
                              title="重新上架后会回到今日菜单"
                            >
                              {dishTogglingId === dish.dishId ? '保存中…' : (
                                <>
                                  <IconEye size={13} />
                                  重新上架
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="menu-item__sale-toggle"
                              onClick={() => void toggleDishInToday(dish)}
                              disabled={!isSample || todayTogglingId !== null || dailySaving || dishDeletingId !== null}
                              title={!isSample ? '真实服务暂未提供每日菜单接口' : undefined}
                              aria-busy={todayTogglingId === dish.dishId || undefined}
                              data-today-toggle={dish.dishId}
                            >
                              {todayTogglingId === dish.dishId ? '保存中…' : inToday ? '移出今日' : '加入今日'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="menu-item__edit"
                            onClick={() => startDishEdit(displayDish)}
                            title={!inToday ? '先加入今日菜单，再编辑名称、价格与库存' : undefined}
                            disabled={
                              !inToday
                              || !canEditVersion(displayDish.version)
                              || dishSaving
                              || dishDeletingId !== null
                              || editingDishId === dish.dishId
                            }
                          >
                            {editingDishId === dish.dishId ? '编辑中' : (
                              <>
                                <IconPencil size={13} />
                                编辑
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="menu-item__delete"
                            data-dish-delete={dish.dishId}
                            aria-label={`删除菜品 ${displayDish.name}`}
                            onClick={() => askDeleteDish(displayDish)}
                            disabled={
                              !canEditVersion(displayDish.version)
                              || dishSaving
                              || dishDeletingId !== null
                              || editingDishId === dish.dishId
                            }
                          >
                            <IconTrash2 size={13} />
                            删除
                          </button>
                        </span>
                        {todayToggleFeedback?.dishId === dish.dishId || dishToggleFeedback?.dishId === dish.dishId ? (
                          <p className="action-feedback action-feedback--error menu-item__feedback" role="alert">
                            {todayToggleFeedback?.dishId === dish.dishId
                              ? todayToggleFeedback.message
                              : dishToggleFeedback?.message}
                          </p>
                        ) : null}
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {editingDish && (
            <section className="menu-editor" data-dish-edit={editingDish.dishId} aria-label="编辑菜品">
              <header className="menu-editor__head">
                <div>
                  <h3 className="menu-editor__title">
                    编辑菜品
                    <span className="menu-editor__date">{shortDate(date)}</span>
                  </h3>
                  <p>更新当日菜单与库存；其他日期保持原样。</p>
                </div>
                <div className="menu-editor__head-actions">
                  <button
                    type="button"
                    className="menu-editor__save-top"
                    onClick={() => void submitDish(editingDish)}
                    disabled={dishSaving}
                    data-dish-save-top
                  >
                    {dishSaving ? '保存中…' : '保存'}
                  </button>
                  <button type="button" className="menu-editor__close" onClick={cancelDishEdit} disabled={dishSaving}>
                    <IconChevronUp size={14} />
                    收起
                  </button>
                </div>
              </header>
              <div className="dish-editor-v8" data-dish-editor-grid>
                <div className="dish-editor-v8__main">
                  <section className="dish-base" aria-label="菜品基础信息">
                    <div className="menu-editor__fields">
                      <label className={dishFieldErrors.name ? 'menu-field menu-field--name is-error' : 'menu-field menu-field--name'}>
                        <span className="menu-field__label">菜品名称</span>
                        <input
                          value={dishName}
                          maxLength={30}
                          onChange={(event) => {
                            setDishName(event.target.value);
                            clearDishFieldError('name');
                          }}
                          aria-label="菜品名称"
                          aria-invalid={dishFieldErrors.name ? 'true' : undefined}
                          aria-describedby={dishFieldErrors.name ? 'edit-dish-name-error' : undefined}
                          placeholder="例如：宫保鸡丁饭"
                        />
                        {dishFieldErrors.name && (
                          <span id="edit-dish-name-error" className="menu-field__error" data-dish-field-error="name">
                            {dishFieldErrors.name}
                          </span>
                        )}
                      </label>
                      <label className={dishFieldErrors.type ? 'menu-field is-error' : 'menu-field'}>
                        <span className="menu-field__label">菜品类别</span>
                        <select
                          value={dishType}
                          onChange={(event) => {
                            setDishType(event.target.value as DishType);
                            clearDishFieldError('type');
                          }}
                          aria-label="菜品类别"
                          aria-invalid={dishFieldErrors.type ? 'true' : undefined}
                        >
                          {DISH_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {dishFieldErrors.type && (
                          <span id="edit-dish-type-error" className="menu-field__error" data-dish-field-error="type">
                            {dishFieldErrors.type}
                          </span>
                        )}
                      </label>
                      <label className={dishFieldErrors.priceText ? 'menu-field is-error' : 'menu-field'}>
                        <span className="menu-field__label">价格（元）</span>
                        <input
                          value={dishPrice}
                          onChange={(event) => {
                            setDishPrice(event.target.value);
                            clearDishFieldError('priceText');
                          }}
                          inputMode="decimal"
                          aria-label="菜品价格（元）"
                          aria-invalid={dishFieldErrors.priceText ? 'true' : undefined}
                          aria-describedby={dishFieldErrors.priceText ? 'edit-dish-price-error' : undefined}
                          placeholder="例如：18.00"
                        />
                        {dishFieldErrors.priceText && (
                          <span id="edit-dish-price-error" className="menu-field__error" data-dish-field-error="priceText">
                            {dishFieldErrors.priceText}
                          </span>
                        )}
                      </label>
                      <label className={dishFieldErrors.quantityText ? 'menu-field is-error' : 'menu-field'}>
                        <span className="menu-field__label">库存（份）</span>
                        <input
                          value={dishQuantity}
                          onChange={(event) => {
                            setDishQuantity(event.target.value);
                            clearDishFieldError('quantityText');
                          }}
                          inputMode="numeric"
                          aria-label="菜品可售数量"
                          aria-invalid={dishFieldErrors.quantityText ? 'true' : undefined}
                          aria-describedby={dishFieldErrors.quantityText ? 'edit-dish-quantity-error' : undefined}
                          placeholder="例如：30"
                        />
                        {dishFieldErrors.quantityText && (
                          <span id="edit-dish-quantity-error" className="menu-field__error" data-dish-field-error="quantityText">
                            {dishFieldErrors.quantityText}
                          </span>
                        )}
                      </label>
                      <label className="menu-field menu-field--switch">
                        <input
                          type="checkbox"
                          checked={dishOnSale}
                          onChange={(event) => setDishOnSale(event.target.checked)}
                          aria-label="菜品在售"
                        />
                        <span>在售</span>
                      </label>
                    </div>
                  </section>
                  <DishCustomizeEditor
                    value={dishCustomDraft}
                    onChange={(next) => {
                      setDishCustomDraft(next);
                      setDishCustomError(null);
                    }}
                    disabled={dishSaving}
                    mode={scope}
                  />
                </div>
                <aside className="dish-editor-v8__preview" data-dish-preview>
                  <DishCustomizePreview
                    key={`edit-${editingDish.dishId}-${dishRequestId}`}
                    value={dishCustomDraft}
                    dishName={dishName}
                    unitPriceFen={priceFenFromText(dishPrice)}
                    priceText={dishPrice}
                  />
                </aside>
              </div>
              {dishError && (
                <p className="action-feedback action-feedback--error" role="alert" data-menu-error>
                  {dishError}
                </p>
              )}
              {dishCustomError && (
                <p className="action-feedback action-feedback--error" role="alert" data-dish-cx-error>
                  {dishCustomError}
                </p>
              )}
              <footer className="menu-editor__actions">
                <button
                  type="button"
                  className="action-button action-button--primary"
                  onClick={() => void submitDish(editingDish)}
                  disabled={dishSaving}
                  aria-busy={dishSaving || undefined}
                  data-dish-save
                >
                  {dishSaving ? '保存中…' : '保存菜品与配置'}
                </button>
                <button type="button" className="action-button" onClick={cancelDishEdit} disabled={dishSaving}>
                  取消
                </button>
                <span className="menu-editor__note">保存前会校验名称、价格、库存与选项。</span>
              </footer>
            </section>
          )}


          {deletingDish && (
            <section className="menu-confirm" data-dish-delete-confirm={deletingDish.dishId} aria-label="确认删除菜品">
              <h3>删除「{deletingDish.name}」？</h3>
              <p>
                会从菜品库和所有日期移除，历史订单保留原菜名；图片、口味特征、固定配菜与加购项会一并删除。
                如果只是今天不想卖，请到「菜品 · 总菜单」里点「移出今日」或取消今日勾选。
              </p>
              <div className="action-bar">
                <button
                  type="button"
                  className="action-button action-button--danger"
                  onClick={() => void submitDeleteDish(deletingDish)}
                  disabled={dishDeletingId !== null}
                  aria-busy={dishDeletingId === deletingDish.dishId || undefined}
                >
                  {dishDeletingId === deletingDish.dishId ? '删除中…' : '确认删除'}
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={cancelDeleteDish}
                  disabled={dishDeletingId !== null}
                >
                  取消
                </button>
              </div>
              {dishDeleteError && (
                <p className="action-feedback action-feedback--error" role="alert" data-menu-error>
                  {dishDeleteError}
                </p>
              )}
            </section>
          )}

          {creatingDish && (
            <section className="menu-editor" data-dish-create-form aria-label="新增菜品">
              <header className="menu-editor__head">
                <div>
                  <h3 className="menu-editor__title">
                    新增菜品
                    <span className="menu-editor__date">{shortDate(date)}</span>
                  </h3>
                  <p>新增后加入对应日期菜单，其他日期不会自动上架；保存前可实时预览学生端效果。</p>
                </div>
                <div className="menu-editor__head-actions">
                  <button
                    type="button"
                    className="menu-editor__save-top"
                    onClick={() => void submitCreateDish()}
                    disabled={newDishSaving}
                    data-dish-save-top
                  >
                    {newDishSaving ? '保存中…' : '保存'}
                  </button>
                  <button type="button" className="menu-editor__close" onClick={cancelCreateDish} disabled={newDishSaving}>
                    <IconChevronUp size={14} />
                    收起
                  </button>
                </div>
              </header>
              <div className="dish-editor-v8" data-dish-editor-grid>
                <div className="dish-editor-v8__main">
                  <section className="dish-base" aria-label="菜品基础信息">
                    <div className="menu-editor__fields">
                      <label className={newDishFieldErrors.name ? 'menu-field menu-field--name is-error' : 'menu-field menu-field--name'}>
                        <span className="menu-field__label">菜品名称</span>
                        <input
                          value={newDishName}
                          maxLength={30}
                          onChange={(event) => {
                            setNewDishName(event.target.value);
                            clearNewDishFieldError('name');
                          }}
                          aria-label="新增菜品名称"
                          aria-invalid={newDishFieldErrors.name ? 'true' : undefined}
                          aria-describedby={newDishFieldErrors.name ? 'new-dish-name-error' : undefined}
                          placeholder="例如：宫保鸡丁饭"
                        />
                        {newDishFieldErrors.name && (
                          <span id="new-dish-name-error" className="menu-field__error" data-dish-field-error="name">
                            {newDishFieldErrors.name}
                          </span>
                        )}
                      </label>
                      <label className={newDishFieldErrors.type ? 'menu-field is-error' : 'menu-field'}>
                        <span className="menu-field__label">菜品类别</span>
                        <select
                          value={newDishType}
                          onChange={(event) => {
                            setNewDishType(event.target.value as DishType);
                            clearNewDishFieldError('type');
                          }}
                          aria-label="新增菜品类别"
                          aria-invalid={newDishFieldErrors.type ? 'true' : undefined}
                        >
                          {DISH_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {newDishFieldErrors.type && (
                          <span id="new-dish-type-error" className="menu-field__error" data-dish-field-error="type">
                            {newDishFieldErrors.type}
                          </span>
                        )}
                      </label>
                      <label className={newDishFieldErrors.priceText ? 'menu-field is-error' : 'menu-field'}>
                        <span className="menu-field__label">价格（元）</span>
                        <input
                          value={newDishPrice}
                          onChange={(event) => {
                            setNewDishPrice(event.target.value);
                            clearNewDishFieldError('priceText');
                          }}
                          inputMode="decimal"
                          aria-label="新增菜品价格（元）"
                          aria-invalid={newDishFieldErrors.priceText ? 'true' : undefined}
                          aria-describedby={newDishFieldErrors.priceText ? 'new-dish-price-error' : undefined}
                          placeholder="例如：18.00"
                        />
                        {newDishFieldErrors.priceText && (
                          <span id="new-dish-price-error" className="menu-field__error" data-dish-field-error="priceText">
                            {newDishFieldErrors.priceText}
                          </span>
                        )}
                      </label>
                      <label className={newDishFieldErrors.quantityText ? 'menu-field is-error' : 'menu-field'}>
                        <span className="menu-field__label">库存（份）</span>
                        <input
                          value={newDishQuantity}
                          onChange={(event) => {
                            setNewDishQuantity(event.target.value);
                            clearNewDishFieldError('quantityText');
                          }}
                          inputMode="numeric"
                          aria-label="新增菜品可售数量"
                          aria-invalid={newDishFieldErrors.quantityText ? 'true' : undefined}
                          aria-describedby={newDishFieldErrors.quantityText ? 'new-dish-quantity-error' : undefined}
                          placeholder="例如：30"
                        />
                        {newDishFieldErrors.quantityText && (
                          <span id="new-dish-quantity-error" className="menu-field__error" data-dish-field-error="quantityText">
                            {newDishFieldErrors.quantityText}
                          </span>
                        )}
                      </label>
                    </div>
                  </section>
                  <DishCustomizeEditor
                    value={newDishCustomDraft}
                    onChange={(next) => {
                      setNewDishCustomDraft(next);
                      setNewDishCustomError(null);
                    }}
                    disabled={newDishSaving}
                    mode={scope}
                  />
                </div>
                <aside className="dish-editor-v8__preview" data-dish-preview>
                  <DishCustomizePreview
                    key={`create-${newDishRequestId}`}
                    value={newDishCustomDraft}
                    dishName={newDishName}
                    unitPriceFen={priceFenFromText(newDishPrice)}
                    priceText={newDishPrice}
                  />
                </aside>
              </div>
              {newDishCustomError && (
                <p className="action-feedback action-feedback--error" role="alert" data-dish-cx-error>
                  {newDishCustomError}
                </p>
              )}
              {newDishError && (
                <p className="action-feedback action-feedback--error" role="alert" data-menu-error>
                  {newDishError}
                </p>
              )}
              {newDishNeedsShop && (
                <button type="button" className="action-button" onClick={onGoSetup}>
                  先去商家注册与开店
                </button>
              )}
              <footer className="menu-editor__actions">
                <button
                  type="button"
                  className="action-button action-button--primary"
                  onClick={() => void submitCreateDish()}
                  disabled={newDishSaving}
                  aria-busy={newDishSaving || undefined}
                  data-dish-save
                >
                  {newDishSaving ? '保存中…' : '保存新增菜品'}
                </button>
                <button type="button" className="action-button" onClick={cancelCreateDish} disabled={newDishSaving}>
                  取消
                </button>
                <span className="menu-editor__note">保存前会校验名称、价格、库存与选项。</span>
              </footer>
            </section>
          )}


          <details className="menu-notes">
            <summary>菜单规则与数据说明</summary>
            <div className="menu-notes__body">
              <p>
                编辑菜品会更新当前日期菜单的名称、类别、价格、库存和在售状态；删除会从菜品库和所有日期移除，历史订单保留原菜名。
              </p>
              <p data-dish-cx-scope>
                菜品图片、口味特征、固定配菜与加购项由商家自己添加和命名，学生端会显示成可点按钮；改完后点「保存菜品与配置」才会生效。
                {isSample
                  ? '样例模式下图片与选项保存在本机浏览器。'
                  : '真实模式下图片与选项暂存在本机，服务端字段完成后才会同步给学生端。'}
              </p>
              <p data-daily-menu-scope>
                「菜品 · 总菜单」是全部菜品，跨日期共用；「今日菜单」只放当天在售的菜，库存按天单独保存。
                在「今日菜单」里点「从菜品库选今日菜品」可批量勾选并设置今日库存；也可以直接在「菜品 · 总菜单」里加入或移出今日。
                已下架（停售）的菜不会出现在今日菜单；在「菜品 · 总菜单」点「重新上架」后会回到今日菜单。
                移出今日只是当天不卖，菜品库不会删除。
                {isSample
                  ? '样例模式可完整操作，切换日期后各天菜单与库存分别保存。'
                  : '真实服务暂未提供菜品库与每日菜单接口，相关按钮已禁用；接口字段需求已记录，不做本地假成功。'}
              </p>
              {customizationStoreError && (
                <p className="action-feedback action-feedback--error" role="alert" data-dish-cx-store-error>
                  {customizationStoreError}
                </p>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}