import type { DiningMode, DraftItemInput } from '../types';

export const DRAFT_SNAPSHOT_KEY = 'xiu.student.draft.v1';

const VERSION = 2;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface DraftSelection {
  merchantId: string;
  date: string;
  items: DraftItemInput[];
  slotId: string | null;
  diningMode: DiningMode | null;
}

interface StoredDraft extends DraftSelection {
  version: number;
  savedAt: number;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDiningMode(value: unknown): value is DiningMode {
  return value === 'DINE_IN' || value === 'TAKEAWAY';
}

function isItem(value: unknown): value is DraftItemInput {
  return (
    isRecord(value) &&
    typeof value.dishId === 'string' &&
    value.dishId.trim() !== '' &&
    Number.isInteger(value.quantity) &&
    (value.quantity as number) >= 1 &&
    (value.quantity as number) <= 99
  );
}

export function clearDraftSnapshot(): void {
  const target = storage();
  if (!target) {
    return;
  }
  try {
    target.removeItem(DRAFT_SNAPSHOT_KEY);
  } catch {
    // 存储不可用时忽略，内存选择不受影响。
  }
}

export function saveDraftSnapshot(selection: DraftSelection, now: number = Date.now()): void {
  const target = storage();
  if (!target) {
    return;
  }
  const payload: StoredDraft = {
    version: VERSION,
    merchantId: selection.merchantId,
    date: selection.date,
    items: selection.items.map((item) => ({ dishId: item.dishId, quantity: item.quantity })),
    slotId: selection.slotId,
    diningMode: selection.diningMode,
    savedAt: now,
  };
  try {
    target.setItem(DRAFT_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // 存储不可用时忽略，不影响当前页面继续操作。
  }
}

export interface ReadDraftOptions {
  allowedDates: string[];
  now?: number;
}

export function readDraftSnapshot({
  allowedDates,
  now = Date.now(),
}: ReadDraftOptions): DraftSelection | null {
  const target = storage();
  if (!target) {
    return null;
  }

  let parsed: unknown;
  try {
    const raw = target.getItem(DRAFT_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }
    parsed = JSON.parse(raw);
  } catch {
    clearDraftSnapshot();
    return null;
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== VERSION ||
    typeof parsed.merchantId !== 'string' ||
    parsed.merchantId.trim() === '' ||
    typeof parsed.date !== 'string' ||
    !allowedDates.includes(parsed.date) ||
    !Array.isArray(parsed.items) ||
    parsed.items.length === 0 ||
    !parsed.items.every(isItem) ||
    !(parsed.slotId === null || typeof parsed.slotId === 'string') ||
    !(parsed.diningMode === null || isDiningMode(parsed.diningMode)) ||
    typeof parsed.savedAt !== 'number' ||
    !Number.isFinite(parsed.savedAt) ||
    now - parsed.savedAt > MAX_AGE_MS
  ) {
    clearDraftSnapshot();
    return null;
  }

  return {
    merchantId: parsed.merchantId,
    date: parsed.date,
    items: parsed.items.map((item) => ({ dishId: item.dishId, quantity: item.quantity })),
    slotId: parsed.slotId,
    diningMode: parsed.diningMode,
  };
}