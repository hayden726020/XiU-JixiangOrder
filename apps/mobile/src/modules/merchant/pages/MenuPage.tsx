import { useEffect, useState } from 'react';
import type {
  CreateDishInput,
  DailyMenuSelection,
  Dish,
  DishCustomization,
  DishCustomizationDraft,
  DishType,
  MenuDay,
  SourceResult,
} from '../data/types';
import { createRequestId } from '../../../shared/requestId';
import DishCustomizeEditor from '../components/DishCustomizeEditor';
import DishCustomizePreview from '../components/DishCustomizePreview';
import DishThumb from '../components/DishThumb';
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

interface MenuPageProps {
  dates: ReadonlyArray<string>;
  date: string;
  today: string;
  isSample: boolean;
  loading: boolean;
  error: string | null;
  onDateChange: (date: string) => void;
  menu: MenuDay | null;
  onSaveDish: (dish: Dish, patch: DishPatch, requestId: string) => Promise<SourceResult<Dish>>;
  onCreateDish: (input: CreateDishInput) => Promise<SourceResult<Dish>>;
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
  onDeleteDish,
  dishLibrary,
  dishLibraryLoading,
  dishLibraryError,
  onLoadDishLibrary,
  onSaveDailyMenu,
  onGoSetup,
}: MenuPageProps) {
  const dateOptions = isSample
    ? dates.map((option, index) => ({
      date: option,
      label: `${index === 0 ? '演示日' : '演示次日'} ${shortDate(option)}`,
      isToday: index === 0,
    }))
    : menuDateOptions(dates, today);
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
  }, [date, scope]);

  useEffect(() => {
    if (!editingDishId && !creatingDish) return;
    const selector = editingDishId ? '[data-dish-edit]' : '[data-dish-create-form]';
    const target = document.querySelector(selector);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingDishId, creatingDish]);

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
      const original = menu?.dishes.find((item) => item.dishId === dish.dishId) ?? null;
      if (row.selected && !original) {
        added += 1;
      } else if (!row.selected && original) {
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
      if (!row.selected) continue;
      const text = row.quantityText.trim();
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
        ? `已更新「${shortDate(date)}」的今日菜单：上架 ${result.data.dishes.length} 道菜。样例改动只保存在当前页面内存，刷新后会还原。`
        : `已保存「${shortDate(date)}」的今日菜单：上架 ${result.data.dishes.length} 道菜，服务端已返回最新菜单。`);
      return;
    }
    setDailyError(menuWriteErrorText(result.error.code, result.error.message));
  }

  const dishVersionMissing = !isSample && (menu?.dishes.some((dish) => !canEditVersion(dish.version)) ?? false);

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
    ? menu?.dishes.find((item) => item.dishId === editingDishId) ?? null
    : null;
  const deletingDish = deleteDishId
    ? menu?.dishes.find((item) => item.dishId === deleteDishId) ?? null
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
          <button
            type="button"
            className="action-button"
            onClick={startDailyMenuEdit}
            disabled={!isSample || dailySaving || creatingDish || editingDishId !== null || dishDeletingId !== null}
            title={!isSample ? '真实服务暂未提供菜品库与每日菜单接口，当前仅样例模式可制作菜单' : undefined}
            data-open-daily-menu
          >
            制作今日菜单
          </button>
          <button
            type="button"
            className="action-button action-button--primary"
            onClick={startCreateDish}
            disabled={creatingDish || newDishSaving}
            data-dish-create
          >
            + 新增菜品
          </button>
        </div>
      </header>

      {dishVersionMissing && (
        <p className="hint menu-page__version-warning" data-menu-version-missing>
          服务端 GET /menu 未返回 dish.version，编辑与删除按钮已禁用；已记录给后端补字段。
        </p>
      )}

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
          {dailyMenuOpen && (
            <section className="daily-menu" data-daily-menu-editor aria-label="制作今日菜单">
              <header className="daily-menu__head">
                <div>
                  <h3>制作今日菜单</h3>
                  <p>
                    {isSample ? `演示日 ${shortDate(date)}` : shortDate(date)}
                    · 从菜品库勾选今天要卖的菜，并设置今日库存；只影响这一天。
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
                <p className="menu-card__empty">菜品库还是空的，先「+ 新增菜品」。</p>
              )}
              {dailyLibrary.length > 0 && (
                <ul className="daily-menu__list">
                  {dailyLibrary.map((dish) => {
                    const row = dailyRow(dish);
                    const custom = customizations[dish.dishId];
                    const imageUrl = custom?.imageUrl ?? dish.imageUrl;
                    const qtyText = row.quantityText.trim();
                    const soldOut = row.selected && /^\d+$/.test(qtyText) && Number(qtyText) === 0;
                    return (
                      <li
                        key={dish.dishId}
                        className={row.selected ? 'daily-menu__item is-on' : 'daily-menu__item'}
                        data-daily-dish={dish.dishId}
                      >
                        <label className="daily-menu__check">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(event) => updateDailyRow(dish, { selected: event.target.checked })}
                            aria-label={`今天上架 ${dish.name}`}
                          />
                          <span>{row.selected ? '上架' : '不上架'}</span>
                        </label>
                        <DishThumb size="sm" src={imageUrl} alt="" />
                        <span className="daily-menu__info">
                          <strong>{dish.name}</strong>
                          <span>
                            {dish.type ? dishTypeLabel(dish.type) : '未分类'} · {formatYuan(dish.unitPriceFen)}
                          </span>
                        </span>
                        <span className="daily-menu__state">
                          {!row.selected ? (
                            <span className="menu-badge">今日不上架</span>
                          ) : soldOut ? (
                            <span className="menu-badge menu-badge--soldout">售罄</span>
                          ) : (
                            <span className="menu-badge menu-badge--on">上架中</span>
                          )}
                        </span>
                        <label className="daily-menu__qty">
                          <span>今日库存</span>
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

          <section className="menu-card" aria-label="菜品列表">
            <header className="menu-card__head">
              <div>
                <h3>菜品</h3>
                <p>共 {menu.dishes.length} 道 · {isSample ? `演示日 ${shortDate(date)}` : shortDate(date)}</p>
              </div>
              <span className="menu-card__hint">{isSample ? '样例可编辑' : '真实数据'}</span>
            </header>
            {menu.dishes.length === 0 ? (
              <p className="menu-card__empty">这一天还没有菜品，可先新增菜品或制作今日菜单。</p>
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
                          {!dish.onSale ? (
                            <>
                              <span className="menu-badge menu-badge--off">已下架</span>
                              {dish.availableQuantity === 0 && (
                                <span className="menu-badge menu-badge--soldout">已售罄</span>
                              )}
                            </>
                          ) : dish.availableQuantity === 0 ? (
                            <span className="menu-badge menu-badge--soldout">已售罄</span>
                          ) : (
                            <span className="menu-badge menu-badge--on">在售</span>
                          )}
                          <span className="menu-item__qty">库存 {dish.availableQuantity}</span>
                          <span className="menu-item__version">
                            {canEditVersion(dish.version) ? `v${dish.version}` : 'version 未返回'}
                          </span>
                        </span>
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
              </ul>
            )}
          </section>

          {editingDish && (
            <section className="menu-editor" data-dish-edit={editingDish.dishId} aria-label="编辑菜品">
              <header className="menu-editor__head">
                <div>
                  <h3>编辑菜品</h3>
                  <p>更新「{shortDate(date)}」的菜单与库存；其他日期保持原样。</p>
                </div>
                <div className="menu-editor__head-actions">
                  <button
                    type="button"
                    className="menu-editor__save-top"
                    onClick={() => void submitDish(editingDish)}
                    disabled={dishSaving}
                  >
                    {dishSaving ? '保存中…' : '保存'}
                  </button>
                  <button type="button" className="menu-editor__close" onClick={cancelDishEdit} disabled={dishSaving}>
                    收起
                  </button>
                </div>
              </header>
              <div className="menu-editor__fields">
                <label className="menu-field menu-field--name">
                  菜品名称
                  <input
                    value={dishName}
                    maxLength={30}
                    onChange={(event) => setDishName(event.target.value)}
                    aria-label="菜品名称"
                  />
                </label>
                <label className="menu-field">
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
                <label className="menu-field">
                  价格（元）
                  <input
                    value={dishPrice}
                    onChange={(event) => setDishPrice(event.target.value)}
                    inputMode="decimal"
                    aria-label="菜品价格（元）"
                  />
                </label>
                <label className="menu-field">
                  库存
                  <input
                    value={dishQuantity}
                    onChange={(event) => setDishQuantity(event.target.value)}
                    inputMode="numeric"
                    aria-label="菜品可售数量"
                  />
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
              <footer className="menu-editor__actions">
                <button
                  type="button"
                  className="action-button action-button--primary"
                  onClick={() => void submitDish(editingDish)}
                  disabled={dishSaving}
                  aria-busy={dishSaving || undefined}
                >
                  {dishSaving ? '保存中…' : '保存菜品与配置'}
                </button>
                <button type="button" className="action-button" onClick={cancelDishEdit} disabled={dishSaving}>
                  取消
                </button>
                <span className="menu-editor__note">保存前会校验名称、价格、库存与选项。</span>
              </footer>
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
            </section>
          )}

          {deletingDish && (
            <section className="menu-confirm" data-dish-delete-confirm={deletingDish.dishId} aria-label="确认删除菜品">
              <h3>删除「{deletingDish.name}」？</h3>
              <p>
                会从菜品库和所有日期移除，历史订单保留原菜名；图片、口味特征、固定配菜与加购项会一并删除。
                如果只是今天不想卖，请在「制作今日菜单」里取消勾选。
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
                  <h3>新增菜品</h3>
                  <p>新增后加入「{shortDate(date)}」的菜单，其他日期不会自动上架。</p>
                </div>
                <button type="button" className="menu-editor__close" onClick={cancelCreateDish} disabled={newDishSaving}>
                  收起
                </button>
              </header>
              <div className="menu-editor__fields">
                <label className="menu-field menu-field--name">
                  菜品名称
                  <input
                    value={newDishName}
                    maxLength={30}
                    onChange={(event) => setNewDishName(event.target.value)}
                    aria-label="新增菜品名称"
                  />
                </label>
                <label className="menu-field">
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
                <label className="menu-field">
                  价格（元）
                  <input
                    value={newDishPrice}
                    onChange={(event) => setNewDishPrice(event.target.value)}
                    inputMode="decimal"
                    aria-label="新增菜品价格（元）"
                  />
                </label>
                <label className="menu-field">
                  库存
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
              <footer className="menu-editor__actions">
                <button
                  type="button"
                  className="action-button action-button--primary"
                  onClick={() => void submitCreateDish()}
                  disabled={newDishSaving}
                  aria-busy={newDishSaving || undefined}
                >
                  {newDishSaving ? '新增中…' : '确认新增菜品与配置'}
                </button>
                <button type="button" className="action-button" onClick={cancelCreateDish} disabled={newDishSaving}>
                  取消
                </button>
              </footer>
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
                「制作今日菜单」从菜品库勾选当天上架的菜并设当天库存；没勾选的不进学生端，菜品库本身不删。
                {isSample
                  ? '样例模式可完整操作，切换日期后各天菜单与库存分别保存。'
                  : '真实服务暂未提供菜品库与每日菜单接口，按钮已禁用；接口字段需求已记录，不做本地假成功。'}
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