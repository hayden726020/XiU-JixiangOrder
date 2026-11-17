import { useState } from 'react';
import type { CreateDishInput, Dish, DishType, MenuDay, Slot, SlotDay, SourceResult } from '../data/types';
import { createRequestId } from '../../../shared/requestId';
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
  onGoSetup,
  onSaveSlot,
  onBack,
}: MenuPageProps) {
  const dateOptions = menuDateOptions(dates, isSample ? (dates[0] ?? today) : today);
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
    setDeleteDishId(null);
    setDishDeleteError(null);
  }

  function cancelDishEdit() {
    if (dishSaving) return;
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
  }

  async function submitDish(dish: Dish) {
    const parsed = parseDishPatch(dishName, dishType, dishPrice, dishQuantity, dishOnSale);
    if (!parsed.ok) {
      setDishError(parsed.error);
      return;
    }
    const requestId = dishRequestId || createRequestId('merchant-dish');
    setDishRequestId(requestId);
    setDishSaving(true);
    setDishError(null);
    const result = await onSaveDish(dish, parsed.patch, requestId);
    setDishSaving(false);
    if (result.ok) {
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
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
    setDeleteDishId(null);
    setDishDeleteError(null);
  }

  function cancelCreateDish() {
    if (newDishSaving) return;
    setCreatingDish(false);
    setNewDishRequestId('');
    setNewDishError(null);
    setNewDishNeedsShop(false);
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
    const requestId = newDishRequestId || createRequestId('merchant-dish-create');
    setNewDishRequestId(requestId);
    setNewDishSaving(true);
    setNewDishError(null);
    setNewDishNeedsShop(false);
    const result = await onCreateDish({ requestId, ...parsed.value });
    setNewDishSaving(false);
    if (result.ok) {
      setCreatingDish(false);
      setNewDishRequestId('');
      setNewDishName('');
      setNewDishPrice('');
      setNewDishQuantity('');
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
            {menu.dishes.length === 0 ? (
              <p className="hint">这一天还没有菜品。</p>
            ) : (
              <ul className="menu-list">
                {menu.dishes.map((dish) => (
                  <li
                    key={dish.dishId}
                    className={dish.onSale ? 'menu-item' : 'menu-item menu-item--off'}
                    data-dish-id={dish.dishId}
                    data-dish-version={dish.version ?? 'missing'}
                  >
                    <span className="menu-item__name">
                      {dish.name}
                      {dish.type && <span className="merchant-readonly-tag">{dishTypeLabel(dish.type)}</span>}
                      {!dish.onSale && <span className="merchant-flag">已停售</span>}
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
                ))}
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
                      <div className="action-bar">
                        <button
                          type="button"
                          className="action-button action-button--secondary"
                          onClick={() => void submitDish(dish)}
                          disabled={dishSaving}
                          aria-busy={dishSaving || undefined}
                        >
                          {dishSaving ? '保存中…' : '保存'}
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
                    </li>
                  );
                })()}
                {deleteDishId && (() => {
                  const dish = menu.dishes.find((item) => item.dishId === deleteDishId);
                  if (!dish) return null;
                  return (
                    <li className="menu-edit menu-edit--danger" data-dish-delete-confirm={dish.dishId}>
                      <p>
                        确定删除「{dish.name}」？删除后学生端菜单不再展示该菜品，历史订单保留原菜名。
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
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => void submitCreateDish()}
                    disabled={newDishSaving}
                    aria-busy={newDishSaving || undefined}
                  >
                    {newDishSaving ? '新增中…' : '确认新增'}
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
              可新增菜品，也可修改名称、类别、价格、可售数量或在售状态、删除菜品；删除后学生端不再展示，历史订单保留原菜名。
            </p>
          </section>

          <section className="detail-block">
            <h3>时段（接单名额）</h3>
            <ul className="slot-list">
              {slots.slots.map((slot) => {
                const closed = !slot.enabled;
                const tone = slot.full || closed ? 'slot-item slot-item--full' : 'slot-item';
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
                    <span>名额 {slot.capacity}</span>
                    <span>已占 {slot.occupied}</span>
                    <span>
                      剩余 {slot.remaining}
                      {slot.full ? '（已满）' : closed ? '（已关闭）' : ''}
                    </span>
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
                      <label>
                        接单名额
                        <input
                          value={slotCapacity}
                          onChange={(event) => setSlotCapacity(event.target.value)}
                          inputMode="numeric"
                          aria-label="时段接单名额"
                        />
                      </label>
                      <label className="menu-edit__check">
                        <input
                          type="checkbox"
                          checked={slotEnabled}
                          onChange={(event) => setSlotEnabled(event.target.checked)}
                          aria-label="时段开放"
                        />
                        开放接单
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
              “接单名额”指订单笔数上限，不是食堂座位数；已占 {slots.slots.reduce((sum, slot) => sum + slot.occupied, 0)} 笔。名额不能低于已占用。
            </p>
          </section>
        </>
      )}
    </div>
  );
}