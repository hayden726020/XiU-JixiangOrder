import { useState } from 'react';
import type { Dish, MenuDay, Slot, SlotDay, SourceResult } from '../data/types';
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
  onSaveSlot,
  onBack,
}: MenuPageProps) {
  const dateOptions = menuDateOptions(dates, today);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishPrice, setDishPrice] = useState('');
  const [dishQuantity, setDishQuantity] = useState('');
  const [dishOnSale, setDishOnSale] = useState(true);
  const [dishRequestId, setDishRequestId] = useState('');
  const [dishError, setDishError] = useState<string | null>(null);
  const [dishSaving, setDishSaving] = useState(false);
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
    setDishPrice((dish.unitPriceFen / 100).toFixed(2));
    setDishQuantity(String(dish.availableQuantity));
    setDishOnSale(dish.onSale);
    setDishRequestId(createRequestId('merchant-dish'));
    setDishError(null);
  }

  function cancelDishEdit() {
    if (dishSaving) return;
    setEditingDishId(null);
    setDishRequestId('');
    setDishError(null);
  }

  async function submitDish(dish: Dish) {
    const parsed = parseDishPatch(dishPrice, dishQuantity, dishOnSale);
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
    <div className="merchant-view">
      <button type="button" className="back-link" onClick={onBack}>← 返回订单列表</button>
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
              ? '价格与可售数量来自样例数据源；编辑只写入本地样例内存，不发送真实请求。'
              : '价格与可售数量来自 GET /menu；服务端返回 version 后才可保存。'}
          </p>
          {(dishVersionMissing || slotVersionMissing) && (
            <p className="hint" data-menu-version-missing>
              服务端 GET /menu 未返回
              {dishVersionMissing ? ' dish.version' : ''}
              {dishVersionMissing && slotVersionMissing ? ' 与' : ''}
              {slotVersionMissing ? ' slot.version' : ''}
              ，编辑按钮已禁用；已记录给后端补字段。
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
            <h3>菜品（{menu.dishes.length}）</h3>
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
                    {!dish.onSale && <span className="merchant-flag">已停售</span>}
                  </span>
                  <span className="menu-item__price">{formatYuan(dish.unitPriceFen)}</span>
                  <span className="menu-item__qty">可售 {dish.availableQuantity}</span>
                  <span className="menu-item__version">
                    {canEditVersion(dish.version) ? `v${dish.version}` : 'version 未返回'}
                  </span>
                  <button
                    type="button"
                    className="menu-item__edit"
                    onClick={() => startDishEdit(dish)}
                    disabled={!canEditVersion(dish.version) || dishSaving || editingDishId === dish.dishId}
                  >
                    {editingDishId === dish.dishId ? '编辑中' : '编辑'}
                  </button>
                </li>
              ))}
              {editingDishId && (() => {
                const dish = menu.dishes.find((item) => item.dishId === editingDishId);
                if (!dish) return null;
                return (
                  <li className="menu-edit" data-dish-edit={dish.dishId}>
                    <div className="menu-edit__fields">
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
            </ul>
            <p className="hint">
              停售后学生端不再展示该菜品；可售数量为 0 时仍可显示但不可加购。
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