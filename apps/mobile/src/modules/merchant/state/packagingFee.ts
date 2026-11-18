import type { MerchantOrder, PackagingFeeSetting } from '../data/types';

export const PACKAGING_FEE_STORAGE_KEY = 'merchant.packaging-fee.v1';

export const PACKAGING_FEE_LIMITS = {
  maxFeeFen: 5_000,
} as const;

export const DEFAULT_PACKAGING_FEE: PackagingFeeSetting = {
  enabled: false,
  feeFen: 100,
};

export type PackagingScope = 'sample' | 'real';

function storageKey(scope: PackagingScope): string {
  return `${PACKAGING_FEE_STORAGE_KEY}:${scope}`;
}

function normalizeFeeFen(value: unknown): number {
  const feeFen = Number(value);
  if (
    !Number.isSafeInteger(feeFen)
    || feeFen < 0
    || feeFen > PACKAGING_FEE_LIMITS.maxFeeFen
  ) {
    return DEFAULT_PACKAGING_FEE.feeFen;
  }
  return feeFen;
}

export function loadPackagingFeeSetting(scope: PackagingScope): PackagingFeeSetting {
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return { ...DEFAULT_PACKAGING_FEE };
    const parsed = JSON.parse(raw) as Partial<PackagingFeeSetting>;
    return {
      enabled: parsed.enabled === true,
      feeFen: normalizeFeeFen(parsed.feeFen),
    };
  } catch {
    return { ...DEFAULT_PACKAGING_FEE };
  }
}

export type PackagingFeeSaveResult = { ok: true } | { ok: false; error: string };

export function savePackagingFeeSetting(
  scope: PackagingScope,
  setting: PackagingFeeSetting,
): PackagingFeeSaveResult {
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(setting));
    return { ok: true };
  } catch {
    return { ok: false, error: '浏览器本地存储不可用，本次设置没有保存。' };
  }
}

export type PackagingFeeParseResult =
  | { ok: true; feeFen: number }
  | { ok: false; error: string };

export function parsePackagingFeeText(text: string): PackagingFeeParseResult {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: '打包盒价格只能填写数字，最多两位小数。' };
  }
  const feeFen = Math.round(Number(trimmed) * 100);
  if (
    !Number.isSafeInteger(feeFen)
    || feeFen < 0
    || feeFen > PACKAGING_FEE_LIMITS.maxFeeFen
  ) {
    return { ok: false, error: '打包盒价格需在 0—50 元之间。' };
  }
  return { ok: true, feeFen };
}

export function packagingFeeSummary(setting: PackagingFeeSetting): string {
  if (!setting.enabled) return '不收取';
  if (setting.feeFen <= 0) return '不收取';
  return `外带每单加收 ¥${(setting.feeFen / 100).toFixed(2)}`;
}

export function orderPackagingFeeFen(order: MerchantOrder): number | null {
  const feeFen = order.packagingFeeFen;
  return typeof feeFen === 'number' && Number.isSafeInteger(feeFen) && feeFen > 0
    ? feeFen
    : null;
}

export function isTakeawayOrder(order: MerchantOrder): boolean {
  return order.diningMode === 'TAKEAWAY';
}