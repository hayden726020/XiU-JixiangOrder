import { useState } from 'react';
import type { Slot, SlotDay, SourceResult } from '../data/types';
import { createRequestId } from '../../../shared/requestId';
import { canEditVersion, menuWriteErrorText } from '../state/menuEdit';
import { formatClock } from '../state/orderView';

interface BusinessHoursPageProps {
  dateLabel: string;
  mode: 'sample' | 'real';
  slots: SlotDay | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onSaveSlot: (slot: Slot, patch: { capacity: number; enabled: boolean }, requestId: string) => Promise<SourceResult<Slot>>;
}

export default function BusinessHoursPage({
  dateLabel,
  mode,
  slots,
  loading,
  error,
  onBack,
  onRefresh,
  refreshing,
  onSaveSlot,
}: BusinessHoursPageProps) {
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [capacityText, setCapacityText] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [requestId, setRequestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEdit(slot: Slot) {
    setEditingSlotId(slot.slotId);
    setCapacityText(String(slot.capacity));
    setEnabled(slot.enabled);
    setRequestId(createRequestId('merchant-hours'));
    setSaveError(null);
  }

  function cancelEdit() {
    if (saving) return;
    setEditingSlotId(null);
    setRequestId('');
    setSaveError(null);
  }

  async function submit(slot: Slot) {
    const text = capacityText.trim();
    const capacity = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000) {
      setSaveError('名额必须是 1—1000 的整数。');
      return;
    }
    if (capacity < slot.occupied) {
      setSaveError(`名额不能低于已预约的 ${slot.occupied} 个。`);
      return;
    }
    const nextRequestId = requestId || createRequestId('merchant-hours');
    setRequestId(nextRequestId);
    setSaving(true);
    setSaveError(null);
    const result = await onSaveSlot(slot, { capacity, enabled }, nextRequestId);
    setSaving(false);
    if (result.ok) {
      setEditingSlotId(null);
      setRequestId('');
      return;
    }
    setSaveError(menuWriteErrorText(result.error.code, result.error.message));
  }

  return (
    <div className="merchant-view business-hours-page">
      <div className="business-hours-page__topbar">
        <button type="button" className="back-link" onClick={onBack}>
          ← 返回
        </button>
        <button
          type="button"
          className="merchant-link-button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          aria-busy={refreshing || undefined}
        >
          {refreshing ? '刷新中…' : '刷新时段'}
        </button>
      </div>

      <header className="merchant-view__header">
        <div>
          <h2>时段设置</h2>
          <p className="lead">
            {dateLabel}
            {mode === 'sample' ? '样例数据' : '真实数据'} · 名额不能低于已预约数量
          </p>
        </div>
      </header>

      {loading ? (
        <p className="merchant-empty">正在读取营业时段…</p>
      ) : error ? (
        <div className="merchant-empty merchant-empty--error">
          <p>时段读取失败：{error}</p>
          <button type="button" className="action-button" onClick={onRefresh} disabled={refreshing}>
            重新加载
          </button>
        </div>
      ) : !slots ? (
        <p className="merchant-empty">没有可显示的营业时段。</p>
      ) : (
        <section className="menu-card menu-card--slots" aria-label="接单时段">
          <header className="menu-card__head">
            <div>
              <h3>接单时段</h3>
              <p>总名额 / 已预约 / 剩余；已满时段学生端不可预约。</p>
            </div>
            <span className="menu-card__hint">{slots.slots.length} 个时段</span>
          </header>
          <ul className="slot-list">
            {slots.slots.map((slot) => {
              const closed = !slot.enabled;
              return (
                <li
                  key={slot.slotId}
                  className={slot.full || closed ? 'slot-item slot-item--full' : 'slot-item'}
                  data-slot-id={slot.slotId}
                  data-slot-version={slot.version ?? 'missing'}
                >
                  <span className="slot-item__time">
                    {formatClock(slot.slotStart)}—{formatClock(slot.slotEnd)}
                    {slot.full ? '（已满）' : closed ? '（已关闭）' : ''}
                  </span>
                  <span>名额 {slot.capacity}</span>
                  <span>已占 {slot.occupied}</span>
                  <span>剩余 {slot.remaining}</span>
                  <button
                    type="button"
                    className="menu-item__edit"
                    onClick={() => startEdit(slot)}
                    disabled={!canEditVersion(slot.version) || saving || editingSlotId === slot.slotId}
                  >
                    {editingSlotId === slot.slotId ? '设置中' : '设置'}
                  </button>
                </li>
              );
            })}
          </ul>

          {editingSlotId && (() => {
            const slot = slots.slots.find((item) => item.slotId === editingSlotId);
            if (!slot) return null;
            return (
              <div className="menu-slot-edit" data-slot-edit={slot.slotId}>
                <span className="menu-slot-edit__title">
                  {formatClock(slot.slotStart)}—{formatClock(slot.slotEnd)}
                </span>
                <label className="menu-field">
                  名额
                  <input
                    value={capacityText}
                    inputMode="numeric"
                    onChange={(event) => setCapacityText(event.target.value)}
                    aria-label="时段名额"
                  />
                </label>
                <label className="menu-field menu-field--switch">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    aria-label="时段开放接单"
                  />
                  <span>开放接单</span>
                </label>
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--primary"
                    onClick={() => void submit(slot)}
                    disabled={saving}
                    aria-busy={saving || undefined}
                  >
                    {saving ? '保存中…' : '保存时段'}
                  </button>
                  <button type="button" className="action-button" onClick={cancelEdit} disabled={saving}>
                    取消
                  </button>
                </div>
                {saveError && (
                  <p className="action-feedback action-feedback--error" role="alert">
                    {saveError}
                  </p>
                )}
              </div>
            );
          })()}

          <p className="menu-card__footnote">
            “开放接单”只影响学生端是否可预约该时段；调整名额不会改变已预约数量。
          </p>
        </section>
      )}
    </div>
  );
}