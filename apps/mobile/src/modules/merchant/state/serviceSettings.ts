import type { MerchantScenario } from '../data/types';

export interface MerchantNotifySettings {
  soundEnabled: boolean;
  cancelAlertEnabled: boolean;
}

const NOTIFY_STORAGE_KEY = 'merchant-notify-settings-v1';

export const DEFAULT_NOTIFY_SETTINGS: MerchantNotifySettings = {
  soundEnabled: true,
  cancelAlertEnabled: true,
};

export function loadNotifySettings(): MerchantNotifySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_NOTIFY_SETTINGS };
  try {
    const raw = window.localStorage.getItem(NOTIFY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MerchantNotifySettings> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_NOTIFY_SETTINGS };
    return {
      soundEnabled: parsed.soundEnabled !== false,
      cancelAlertEnabled: parsed.cancelAlertEnabled !== false,
    };
  } catch {
    return { ...DEFAULT_NOTIFY_SETTINGS };
  }
}

export function saveNotifySettings(settings: MerchantNotifySettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储不可用时只影响本机提醒偏好，不影响订单业务。
  }
}

export interface SpecialBusinessDay {
  date: string;
  note: string;
}

function specialDaysKey(mode: 'sample' | 'real'): string {
  return `merchant-special-business-days-v1:${mode}`;
}

export function loadSpecialBusinessDays(mode: 'sample' | 'real'): SpecialBusinessDay[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(specialDaysKey(mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is SpecialBusinessDay => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry as Partial<SpecialBusinessDay>;
        return typeof candidate.date === 'string'
          && /^\d{4}-\d{2}-\d{2}$/.test(candidate.date)
          && typeof candidate.note === 'string';
      })
      .slice(0, 90);
  } catch {
    return [];
  }
}

export function saveSpecialBusinessDays(
  mode: 'sample' | 'real',
  days: SpecialBusinessDay[],
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(specialDaysKey(mode), JSON.stringify(days.slice(0, 90)));
  } catch {
    // 存储不可用时不记录本机计划，服务端时段不受影响。
  }
}

export interface PausedBusinessRecord {
  date: string;
  slotIds: string[];
  pausedAt: string;
}

const PAUSED_STORAGE_KEY = 'merchant-paused-business-v1';

export function loadPausedBusiness(): PausedBusinessRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PAUSED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PausedBusinessRecord> | null;
    if (
      !parsed
      || typeof parsed.date !== 'string'
      || !Array.isArray(parsed.slotIds)
      || typeof parsed.pausedAt !== 'string'
    ) {
      return null;
    }
    return {
      date: parsed.date,
      slotIds: parsed.slotIds.filter((id): id is string => typeof id === 'string'),
      pausedAt: parsed.pausedAt,
    };
  } catch {
    return null;
  }
}

export function savePausedBusiness(record: PausedBusinessRecord | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (record === null) {
      window.localStorage.removeItem(PAUSED_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PAUSED_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 存储不可用时不记录暂停来源，恢复接单仍需在时段设置中手动开放。
  }
}

export function scenarioDateLabel(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

export function orderDateOf(order: { slotStart: string }): string {
  return order.slotStart.slice(0, 10);
}

export type MerchantSourceScenario = MerchantScenario;