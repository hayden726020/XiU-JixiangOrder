import { useEffect, useState } from 'react';
import type {
  CreateDishInput,
  DailyMenuSelection,
  Dish,
  DishCustomization,
  DishCustomizationDraft,
  DishType,
  MenuDay,
  Slot,
  SlotDay,
  SourceResult,
} from '../data/types';
import { createRequestId } from '../../../shared/requestId';
import DishCustomizeEditor from '../components/DishCustomizeEditor';
import DishCustomizePreview from '../components/DishCustomizePreview';
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
  parseSlotPatch,
  type DishPatch,
  type SlotPatch,
} from '../state/menuEdit';
import { formatClock } from '../state/orderView';
import { DISH_TYPE_OPTIONS, dishTypeLabel, validateNewDish } from '../state/onboarding';
import { formatYuan } from '../utils/money';

interface MenuPageProps {
  dates: ReadonlyArray<string>;
  date: string;
  today: string;
  isSample: boolean;
  loading: boolean;
  error: string | null;
  onDateChange: (date: string) => void;
  menu: MenuDay | null;
  slots: SlotDay | null;
  onSaveDish: (dish: Dish, patch: DishPatch, requestId: string) => Promise<SourceResult<Dish>>;
  onCreateDish: (input: CreateDishInput) => Promise<SourceResult<Dish>>;
  onGoSetup: () => void;
  onDeleteDish: (dish: Dish, requestId: string) => Promise<SourceResult<{ dishId: string }>>;
  dishLibrary: ReadonlyArray<Dish>;
  dishLibraryLoading: boolean;
  dishLibraryError: string | null;
  onLoadDishLibrary: () => void;
  onSaveDailyMenu: (items: DailyMenuSelection[], requestId: string) => Promise<SourceResult<MenuDay>>;
  onSaveSlot: (slot: Slot, patch: SlotPatch, requestId: string) => Promise<SourceResult<Slot>>;
  onBack: () => void;
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
  slots,
  onSaveDish,
  onCreateDish,
  onDeleteDish,
  dishLibrary,
  dishLibraryLoading,
  dishLibraryError,
  onLoadDishLibrary,
  onSaveDailyMenu,
  onGoSetup,
  onSaveSlot,
  onBack,
}: MenuPageProps) {
  const dateOptions = menuDateOptions(dates, isSample ? (dates[0] ?? today) : today);
  const scope: 'sample' | 'real' = isSample ? 'sample' : 'real';
  const [customizations, setCustomizations] = useState<Record<string, DishCustomization>>(() => loadCustomizations(scope));
  const [dishCustomDraft, setDishCustomDraft] = useState<DishCustomizationDraft>(emptyCustomizationDraft);
  const [dishCustomError, setDishCustomError] = useState<string | null>(null);
  const [newDishCustomDraft, setNewDishCustomDraft] = useState<DishCustomizationDraft>(emptyCustomizationDraft);
  const [newDishCustomError, setNewDishCustomError] = useState<string | null>(null);
  const [customizationStoreError, setCustomizationStoreError] = useState<string | null>(null);
  const [dailyMenuOpen, setDailyMenuOpen] = useState(false);
  const [dailyDraft, setDailyDraft] = useState<Record<string, { selected: boolean; quantityText: string }>>({});
  const [dailyRequestId, setDailyRequestId] = useState('');
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailySaving, setDailySaving] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishType, setDishType] = useState<DishType | ''>('STAPLE');
  const [dishPrice, setDishPrice] = useState('');
  const [dishQuantity, setDishQuantity] = useState('');
  const [dishOnSale, setDishOnSale] = useState(true);
  const [dishRequestId, setDishRequestId] = useState('');
  const [dishError, setDishError] = useState<string | null>(null);
  const [dishSaving, setDishSaving] = useState(false);
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
  const [newDishSaving, setNewDishSaving] = useState(false);
  const [newDishNeedsShop, setNewDishNeedsShop] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotCapacity, setSlotCapacity] = useState('');
  const [slotEnabled, setSlotEnabled] = useState(true);
  const [slotRequestId, setSlotRequestId] = useState('');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotSaving, setSlotSaving] = useState(false);

  useEffect(() => {
    setCustomizations(loadCustomizations(scope));
  }, [scope]);

  useEffect(() => {
    setDailyMenuOpen(false);
    setDailyDraft({});
    setDailyRequestId('');
    setDailyError(null);
  }, [date, scope]);

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

  function dailyRow(dish: Dish): { selected: boolean; quantityText: string } {
    const draft = dailyDraft[dish.dishId];
    if (draft) return draft;
    const todayDish = menu?.dishes.find((item) => item.dishId === dish.dishId) ?? null;
    return {
      selected: Boolean(todayDish),
      quantityText: String(todayDish?.availableQuantity ?? dish.availableQuantity),
    };
  }

  function updateDailyRow(dish: Dish, patch: Partial<{ selected: boolean; quantityText: string }>) {
    setDailyDraft((current) => ({
      ...current,
      [dish.dishId]: { ...(current[dish.dishId] ?? dailyRow(dish)), ...patch },
    }));
  }

  function startDailyMenuEdit() {
    if (!isSample) return;
    setDailyMenuOpen(true);
    setDailyDraft({});
    setDailyRequestId(createRequestId('merchant-daily-menu'));
    setDailyError(null);
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
  }

  async function submitDailyMenu() {
    const items: DailyMenuSelection[] = [];
    for (const dish of dailyLibrary) {
      const row = dailyRow(dish);
      if (!row.selected) continue;
      const text = row.quantityText.trim();
      if (!/^\d+$/.test(text)) {
        setDailyError(`「${dish.name}」的今日库存必须是 0 或正整数。`);
        return;
      }
      const quantity = Number(text);
      if (!Number.isSafeInteger(quantity) || quantity > 10_000) {
        setDailyError(`「${dish.name}」的今日库存不能超过 10000。`);
        return;
      }
      items.push({ dishId: dish.dishId, availableQuantity: quantity });
    }
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
      return;
    }
    setDailyError(menuWriteErrorText(result.error.code, result.error.message));
  }

  const dishVersionMissing = !isSample && (menu?.dishes.some((dish) => !canEditVersion(dish.version)) ?? false);
  const slotVersionMissing = !isSample && (slots?.slots.some((slot) => !canEditVersion(slot.version)) ?? false);

  function startDishEdit(dish: Dish) {
    setEditingDishId(dish.dishId);
    setDishName(dish.name);
    setDishType(dish.type ?? 'STAPLE');
    setDishPrice((dish.unitPriceFen / 100).toFixed(2));
    setDishQuantity(String(dish.availableQuantity));
    setDishOnSale(dish.onSale);
    setDishRequestId(createRequestId('merchant-dish'));
    setDishError(null);
    setDishCustomDraft(customizationToDraft(customizationFor(dish)));
    setDishCustomError(null);
    setDeleteDishId(null);
    setDishDeleteError(null);
  }

  function cancelDishEdit() {
    if (dishSaving) return;
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDishCustomError(null);
  }

  async function submitDish(dish: Dish) {
    const parsed = parseDishPatch(dishName, dishType, dishPrice, dishQuantity, dishOnSale);
    if (!parsed.ok) {
      setDishError(parsed.error);
      return;
    }
    const custom = validateCustomizationDraft(dishCustomDraft);
    if (!custom.ok) {
      setDishCustomError(custom.error);
      return;
    }
    setDishCustomError(null);
    const requestId = dishRequestId || createRequestId('merchant-dish');
    setDishRequestId(requestId);
    setDishSaving(true);
    setDishError(null);
    const result = await onSaveDish(dish, parsed.patch, requestId);
    setDishSaving(false);
    if (result.ok) {
      if (hasCustomization(custom.value)) {
        persistCustomizations({ ...customizations, [dish.dishId]: custom.value });
      } else {
        persistCustomizations(Object.fromEntries(
          Object.entries(customizations).filter(([dishId]) => dishId !== dish.dishId),
        ));
      }
      setEditingDishId(null);
      setDishRequestId('');
      return;
    }
    setDishError(menuWriteErrorText(result.error.code, result.error.message));
  }

  function startCreateDish() {
    setCreatingDish(true);
    setNewDishName('');
    setNewDishType('STAPLE');
    setNewDishPrice('');
    setNewDishQuantity('');
    setNewDishRequestId(createRequestId('merchant-dish-create'));
    setNewDishError(null);
    setNewDishNeedsShop(false);
    setNewDishCustomDraft(emptyCustomizationDraft());
    setNewDishCustomError(null);
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDishCustomError(null);
    setDeleteDishId(null);
    setDishDeleteError(null);
  }

  function cancelCreateDish() {
    if (newDishSaving) return;
    setCreatingDish(false);
    setNewDishRequestId('');
    setNewDishError(null);
    setNewDishNeedsShop(false);
    setNewDishCustomDraft(emptyCustomizationDraft());
    setNewDishCustomError(null);
  }

  async function submitCreateDish() {
    const parsed = validateNewDish({
      type: newDishType,
      name: newDishName,
      priceText: newDishPrice,
      quantityText: newDishQuantity,
    });
    if (!parsed.ok) {
      setNewDishError(Object.values(parsed.errors)[0] ?? '请检查新增菜品输入。');
      return;
    }
    const custom = validateCustomizationDraft(newDishCustomDraft);
    if (!custom.ok) {
      setNewDishCustomError(custom.error);
      return;
    }
    setNewDishCustomError(null);
    const requestId = newDishRequestId || createRequestId('merchant-dish-create');
    setNewDishRequestId(requestId);
    setNewDishSaving(true);
    setNewDishError(null);
    setNewDishNeedsShop(false);
    const result = await onCreateDish({ requestId, ...parsed.value });
    setNewDishSaving(false);
    if (result.ok) {
      if (hasCustomization(custom.value)) {
        persistCustomizations({ ...customizations, [result.data.dishId]: custom.value });
      }
      setCreatingDish(false);
      setNewDishRequestId('');
      setNewDishName('');
      setNewDishPrice('');
      setNewDishQuantity('');
      setNewDishCustomDraft(emptyCustomizationDraft());
      setNewDishCustomError(null);
      return;
    }
    setNewDishError(menuWriteErrorText(result.error.code, result.error.message));
    setNewDishNeedsShop(result.error.code === 'SHOP_REQUIRED' || result.error.code === 'MERCHANT_REQUIRED');
  }

  function askDeleteDish(dish: Dish) {
    if (dishDeletingId !== null) return;
    setDeleteDishId(dish.dishId);
    setDeleteRequestId(createRequestId('merchant-dish-delete'));
    setDishDeleteError(null);
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
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
      return;
    }
    setDishDeleteError(menuWriteErrorText(result.error.code, result.error.message));
  }

  function startSlotEdit(slot: Slot) {
    setEditingSlotId(slot.slotId);
    setSlotCapacity(String(slot.capacity));
    setSlotEnabled(slot.enabled);
    setSlotRequestId(createRequestId('merchant-slot'));
    setSlotError(null);
  }

  function cancelSlotEdit() {
    if (slotSaving) return;
    setEditingSlotId(null);
    setSlotRequestId('');
    setSlotError(null);
  }

  async function submitSlot(slot: Slot) {
    const parsed = parseSlotPatch(slotCapacity, slot.occupied, slotEnabled);
    if (!parsed.ok) {
      setSlotError(parsed.error);
      return;
    }
    const requestId = slotRequestId || createRequestId('merchant-slot');
    setSlotRequestId(requestId);
    setSlotSaving(true);
    setSlotError(null);
    const result = await onSaveSlot(slot, parsed.patch, requestId);
    setSlotSaving(false);
    if (result.ok) {
      setEditingSlotId(null);
      setSlotRequestId('');
      return;
    }
    setSlotError(menuWriteErrorText(result.error.code, result.error.message));
  }

  return (
    <div className="merchant-view merchant-menu-page" data-menu-mode={isSample ? 'sample' : 'real'}>
      <button type="button" className="back-link" onClick={onBack}>
        ← 返回订单列表
      </button>
      <header className="merchant-view__header">
        <div>
          <h2>
            菜单与库存
            <span className="merchant-readonly-tag">
              {isSample ? '样例可编辑' : '真实 · 演示服务'}
            </span>
          </h2>
          <p className="lead">
            {isSample
              ? '菜品名称、类别、价格与可售数量来自样例数据源；新增、编辑、改名与删除只写入本地样例内存，不发送真实请求。'
              : '菜品名称、类别、价格与可售数量来自 GET /menu；新增与修改都提交到服务端，version 变化后可继续编辑。'}
          </p>
          {(dishVersionMissing || slotVersionMissing) && (
            <p className="hint" data-menu-version-missing>
              服务端 GET /menu 未返回
              {dishVersionMissing ? ' dish.version' : ''}
              {dishVersionMissing && slotVersionMissing ? ' 与' : ''}
              {slotVersionMissing ? ' slot.version' : ''}
              ，编辑与删除按钮已禁用；已记录给后端补字段。
            </p>
          )}
        </div>
      </header>

      <div className="date-switch">
        {dateOptions.map((option) => (
          <button
            key={option.date}
            type="button"
            className={option.date === date ? 'date-switch__button date-switch__button--active' : 'date-switch__button'}
            onClick={() => onDateChange(option.date)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="merchant-empty">正在读取菜单与时段…</p>
      ) : error ? (
        <p className="merchant-empty">菜单读取失败：{error}</p>
      ) : !menu || !slots ? (
        <p className="merchant-empty">这一天没有数据。</p>
      ) : (
        <>
          <section className="detail-block">
            <div className="menu-section-head">
              <h3>菜品（{menu.dishes.length}）</h3>
              <div className="menu-section-head__actions">
                <button
                  type="button"
                  className="menu-item__edit"
                  onClick={startDailyMenuEdit}
                  disabled={!isSample || dailySaving || creatingDish || editingDishId !== null || dishDeletingId !== null}
                  title={!isSample ? '真实服务暂未提供菜品库与每日菜单接口，当前仅样例模式可制作菜单' : undefined}
                  data-open-daily-menu
                >
                  制作今日菜单
                </button>
                <button
                  type="button"
                  className="menu-item__edit"
                  onClick={startCreateDish}
                  disabled={creatingDish || newDishSaving}
                  data-dish-create
                >
                  + 新增菜品
                </button>
              </div>
            </div>
            {dailyMenuOpen && (
              <div className="daily-menu" data-daily-menu-editor>
                <div className="daily-menu__head">
                  <div>
                    <h4>制作今日菜单 · {date}</h4>
                    <p className="hint">
                      从菜品库勾选今天要卖的菜；没勾选的不会出现在学生端。今日库存按天单独保存，不动菜品库里的其他信息。
                    </p>
                  </div>
                  <span className="merchant-readonly-tag">库内 {dailyLibrary.length} 道</span>
                </div>
                {dishLibraryLoading && <p className="hint">正在读取菜品库…</p>}
                {dishLibraryError && (
                  <p className="action-feedback action-feedback--error" role="alert" data-daily-menu-error>
                    {dishLibraryError}
                  </p>
                )}
                {!dishLibraryLoading && !dishLibraryError && dailyLibrary.length === 0 && (
                  <p className="hint">菜品库还是空的，先「+ 新增菜品」。</p>
                )}
                {dailyLibrary.length > 0 && (
                  <ul className="daily-menu__list">
                    {dailyLibrary.map((dish) => {
                      const row = dailyRow(dish);
                      const custom = customizations[dish.dishId];
                      const imageUrl = custom?.imageUrl ?? dish.imageUrl;
                      return (
                        <li
                          key={dish.dishId}
                          className={row.selected ? 'daily-menu__item daily-menu__item--on' : 'daily-menu__item'}
                          data-daily-dish={dish.dishId}
                        >
                          <label className="daily-menu__check">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(event) => updateDailyRow(dish, { selected: event.target.checked })}
                              aria-label={`今天上架 ${dish.name}`}
                            />
                            <span>{row.selected ? '上架' : '未上架'}</span>
                          </label>
                          <span className="menu-item__thumb" aria-hidden={imageUrl ? undefined : true}>
                            {imageUrl
                              ? <img src={imageUrl} alt="" />
                              : <span className="menu-item__thumb-empty">无图</span>}
                          </span>
                          <span className="daily-menu__info">
                            <strong>{dish.name}</strong>
                            <span className="hint">
                              {dish.type ? dishTypeLabel(dish.type) : '未分类'} · {formatYuan(dish.unitPriceFen)}
                            </span>
                          </span>
                          <label className="daily-menu__qty">
                            今日库存
                            <input
                              value={row.quantityText}
                              inputMode="numeric"
                              disabled={!row.selected}
                              onChange={(event) => updateDailyRow(dish, { quantityText: event.target.value })}
                              aria-label={`${dish.name} 今日库存`}
                            />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => void submitDailyMenu()}
                    disabled={dailySaving || dishLibraryLoading || Boolean(dishLibraryError)}
                    aria-busy={dailySaving || undefined}
                    data-daily-menu-save
                  >
                    {dailySaving ? '保存中…' : '保存今日菜单'}
                  </button>
                  <button
                    type="button"
                    className="action-button"
                    onClick={cancelDailyMenuEdit}
                    disabled={dailySaving}
                  >
                    取消
                  </button>
                </div>
                {dailyError && (
                  <p className="action-feedback action-feedback--error" role="alert" data-daily-menu-error>
                    {dailyError}
                  </p>
                )}
              </div>
            )}
            {menu.dishes.length === 0 ? (
              <p className="hint">这一天还没有菜品。</p>
            ) : (
              <ul className="menu-list">
                {menu.dishes.map((dish) => {
                  const custom = customizations[dish.dishId];
                  const badge = customizationBadge(custom);
                  const imageUrl = custom?.imageUrl ?? dish.imageUrl;
                  return (
                  <li
                    key={dish.dishId}
                    className={dish.onSale ? 'menu-item' : 'menu-item menu-item--off'}
                    data-dish-id={dish.dishId}
                    data-dish-version={dish.version ?? 'missing'}
                  >
                    <span className="menu-item__thumb" aria-hidden={imageUrl ? undefined : true}>
                      {imageUrl
                        ? <img src={imageUrl} alt={`${dish.name} 图片`} />
                        : <span className="menu-item__thumb-empty">无图</span>}
                    </span>
                    <span className="menu-item__name">
                      {dish.name}
                      {dish.type && <span className="merchant-readonly-tag">{dishTypeLabel(dish.type)}</span>}
                      {!dish.onSale && <span className="merchant-flag">已停售</span>}
                      {badge && <span className="merchant-readonly-tag dish-cx-badge">{badge}</span>}
                    </span>
                    <span className="menu-item__price">{formatYuan(dish.unitPriceFen)}</span>
                    <span className="menu-item__qty">可售 {dish.availableQuantity}</span>
                    <span className="menu-item__version">
                      {canEditVersion(dish.version) ? `v${dish.version}` : 'version 未返回'}
                    </span>
                    <span className="menu-item__actions">
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
                        {editingDishId === dish.dishId ? '编辑中' : '编辑'}
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
                        删除
                      </button>
                    </span>
                  </li>
                  );
                })}
                {editingDishId && (() => {
                  const dish = menu.dishes.find((item) => item.dishId === editingDishId);
                  if (!dish) return null;
                  return (
                    <li className="menu-edit" data-dish-edit={dish.dishId}>
                      <div className="menu-edit__fields">
                        <label className="menu-edit__name">
                          菜品名称
                          <input
                            value={dishName}
                            maxLength={30}
                            onChange={(event) => setDishName(event.target.value)}
                            aria-label="菜品名称"
                          />
                        </label>
                        <label>
                          菜品类别
                          <select
                            value={dishType}
                            onChange={(event) => setDishType(event.target.value as DishType)}
                            aria-label="菜品类别"
                          >
                            {DISH_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          价格（元）
                          <input
                            value={dishPrice}
                            onChange={(event) => setDishPrice(event.target.value)}
                            inputMode="decimal"
                            aria-label="菜品价格（元）"
                          />
                        </label>
                        <label>
                          可售数量
                          <input
                            value={dishQuantity}
                            onChange={(event) => setDishQuantity(event.target.value)}
                            inputMode="numeric"
                            aria-label="菜品可售数量"
                          />
                        </label>
                        <label className="menu-edit__check">
                          <input
                            type="checkbox"
                            checked={dishOnSale}
                            onChange={(event) => setDishOnSale(event.target.checked)}
                            aria-label="菜品在售"
                          />
                          在售
                        </label>
                      </div>
                      <div className="dish-cx-layout">
                        <DishCustomizeEditor
                          value={dishCustomDraft}
                          onChange={setDishCustomDraft}
                          disabled={dishSaving}
                          mode={scope}
                        />
                        <DishCustomizePreview
                          value={dishCustomDraft}
                          dishName={dishName}
                          unitPriceFen={priceFenFromText(dishPrice)}
                        />
                      </div>
                      <div className="action-bar">
                        <button
                          type="button"
                          className="action-button action-button--secondary"
                          onClick={() => void submitDish(dish)}
                          disabled={dishSaving}
                          aria-busy={dishSaving || undefined}
                        >
                          {dishSaving ? '保存中…' : '保存菜品与配置'}
                        </button>
                        <button
                          type="button"
                          className="action-button"
                          onClick={cancelDishEdit}
                          disabled={dishSaving}
                        >
                          取消
                        </button>
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
                    </li>
                  );
                })()}
                {deleteDishId && (() => {
                  const dish = menu.dishes.find((item) => item.dishId === deleteDishId);
                  if (!dish) return null;
                  return (
                    <li className="menu-edit menu-edit--danger" data-dish-delete-confirm={dish.dishId}>
                      <p>
                        确定删除「{dish.name}」？这会从菜品库和所有日期移除，历史订单保留原菜名。
                        该菜品的图片、口味特征、固定配菜与加购项会一起删除；如果只是今天不想卖，请在「制作今日菜单」里取消勾选。
                      </p>
                      <div className="action-bar">
                        <button
                          type="button"
                          className="action-button action-button--secondary"
                          onClick={() => void submitDeleteDish(dish)}
                          disabled={dishDeletingId !== null}
                          aria-busy={dishDeletingId === dish.dishId || undefined}
                        >
                          {dishDeletingId === dish.dishId ? '删除中…' : '确认删除'}
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
                    </li>
                  );
                })()}
              </ul>
            )}
            {creatingDish && (
              <div className="menu-edit" data-dish-create-form>
                <div className="menu-edit__fields">
                  <label className="menu-edit__name">
                    菜品名称
                    <input
                      value={newDishName}
                      maxLength={30}
                      onChange={(event) => setNewDishName(event.target.value)}
                      aria-label="新增菜品名称"
                    />
                  </label>
                  <label>
                    菜品类别
                    <select
                      value={newDishType}
                      onChange={(event) => setNewDishType(event.target.value as DishType)}
                      aria-label="新增菜品类别"
                    >
                      {DISH_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    价格（元）
                    <input
                      value={newDishPrice}
                      onChange={(event) => setNewDishPrice(event.target.value)}
                      inputMode="decimal"
                      aria-label="新增菜品价格（元）"
                    />
                  </label>
                  <label>
                    可售数量
                    <input
                      value={newDishQuantity}
                      onChange={(event) => setNewDishQuantity(event.target.value)}
                      inputMode="numeric"
                      aria-label="新增菜品可售数量"
                    />
                  </label>
                </div>
                <div className="dish-cx-layout">
                  <DishCustomizeEditor
                    value={newDishCustomDraft}
                    onChange={setNewDishCustomDraft}
                    disabled={newDishSaving}
                    mode={scope}
                  />
                  <DishCustomizePreview
                    value={newDishCustomDraft}
                    dishName={newDishName}
                    unitPriceFen={priceFenFromText(newDishPrice)}
                  />
                </div>
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => void submitCreateDish()}
                    disabled={newDishSaving}
                    aria-busy={newDishSaving || undefined}
                  >
                    {newDishSaving ? '新增中…' : '确认新增菜品与配置'}
                  </button>
                  <button
                    type="button"
                    className="action-button"
                    onClick={cancelCreateDish}
                    disabled={newDishSaving}
                  >
                    取消
                  </button>
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
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={onGoSetup}
                  >
                    先去商家注册与开店
                  </button>
                )}
              </div>
            )}
            <p className="hint">
              可新增菜品，也可修改名称、类别、价格、可售数量或在售状态、删除菜品；删除会从菜品库和所有日期移除，历史订单保留原菜名。
            </p>
            <p className="hint" data-dish-cx-scope>
              菜品图片、口味特征、固定配菜与加购项由商家自己添加和命名，学生端会显示成可点按钮；改完后点「保存菜品与配置」才会生效。
              {isSample
                ? '样例模式保存在本机样例内存，刷新页面后仍在。'
                : '当前先保存在本机，服务端图片与选项字段完成后才会同步给学生端；不会影响现有价格、库存和时段。'}
            </p>
            <p className="hint" data-daily-menu-scope>
              「制作今日菜单」从菜品库勾选今天上架的菜并设当天库存；没勾选的不进学生端，菜品库本身不删。
              {isSample
                ? '样例模式可完整操作，切换日期后各天菜单分别保存。'
                : '真实服务暂未提供菜品库与每日菜单接口，按钮已禁用；接口字段需求已记录，不做本地假成功。'}
            </p>
            {customizationStoreError && (
              <p className="action-feedback action-feedback--error" role="alert" data-dish-cx-store-error>
                {customizationStoreError}
              </p>
            )}
          </section>

          <section className="detail-block">
            <h3>取餐时段</h3>
            <ul className="slot-list">
              {slots.slots.map((slot) => {
                const closed = !slot.enabled;
                const tone = closed ? 'slot-item slot-item--full' : 'slot-item';
                return (
                  <li
                    key={slot.slotId}
                    className={tone}
                    data-slot-id={slot.slotId}
                    data-slot-version={slot.version ?? 'missing'}
                  >
                    <span className="slot-item__time">
                      {formatClock(slot.slotStart)}—{formatClock(slot.slotEnd)}
                    </span>
                    <span>已接单 {slot.occupied} 笔</span>
                    <span>{closed ? '已关闭' : '开放接单 · 不限名额'}</span>
                    <span className="slot-item__version">
                      {canEditVersion(slot.version) ? `v${slot.version}` : 'version 未返回'}
                    </span>
                    <button
                      type="button"
                      className="menu-item__edit"
                      onClick={() => startSlotEdit(slot)}
                      disabled={!canEditVersion(slot.version) || slotSaving || editingSlotId === slot.slotId}
                    >
                      {editingSlotId === slot.slotId ? '编辑中' : '编辑'}
                    </button>
                  </li>
                );
              })}
              {editingSlotId && (() => {
                const slot = slots.slots.find((item) => item.slotId === editingSlotId);
                if (!slot) return null;
                return (
                  <li className="menu-edit" data-slot-edit={slot.slotId}>
                    <div className="menu-edit__fields">
                      <label className="menu-edit__check">
                        <input
                          type="checkbox"
                          checked={slotEnabled}
                          onChange={(event) => setSlotEnabled(event.target.checked)}
                          aria-label="时段开放"
                        />
                        开放接单（不限制接单名额）
                      </label>
                    </div>
                    <div className="action-bar">
                      <button
                        type="button"
                        className="action-button action-button--secondary"
                        onClick={() => void submitSlot(slot)}
                        disabled={slotSaving}
                        aria-busy={slotSaving || undefined}
                      >
                        {slotSaving ? '保存中…' : '保存'}
                      </button>
                      <button
                        type="button"
                        className="action-button"
                        onClick={cancelSlotEdit}
                        disabled={slotSaving}
                      >
                        取消
                      </button>
                    </div>
                    {slotError && (
                      <p className="action-feedback action-feedback--error" role="alert" data-menu-error>
                        {slotError}
                      </p>
                    )}
                  </li>
                );
              })()}
            </ul>
            <p className="hint">
              各时段均不设接单名额上限，仅通过「开放接单」控制该时段是否可预约；当前合计已接单 {slots.slots.reduce((sum, slot) => sum + slot.occupied, 0)} 笔。
            </p>
          </section>
        </>
      )}
    </div>
  );
}