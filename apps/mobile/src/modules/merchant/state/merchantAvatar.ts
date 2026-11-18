export const MERCHANT_AVATAR_STORAGE_KEY = 'merchant.avatar.v1';

export const MERCHANT_AVATAR_MAX_DATA_URL_LENGTH = 1_200_000;

export type MerchantAvatarScope = 'sample' | 'real';

function storageKey(scope: MerchantAvatarScope): string {
  return `${MERCHANT_AVATAR_STORAGE_KEY}:${scope}`;
}

function isAvatarDataUrl(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('data:image/')
    && value.length <= MERCHANT_AVATAR_MAX_DATA_URL_LENGTH;
}

export function loadMerchantAvatar(scope: MerchantAvatarScope): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    return isAvatarDataUrl(raw) ? raw : null;
  } catch {
    return null;
  }
}

export type MerchantAvatarSaveResult = { ok: true } | { ok: false; error: string };

export function saveMerchantAvatar(
  scope: MerchantAvatarScope,
  dataUrl: string,
): MerchantAvatarSaveResult {
  if (!isAvatarDataUrl(dataUrl)) {
    return { ok: false, error: '图片数据不正确，本次头像没有保存。' };
  }
  try {
    window.localStorage.setItem(storageKey(scope), dataUrl);
    return { ok: true };
  } catch {
    return { ok: false, error: '浏览器本地存储不可用，本次头像没有保存。' };
  }
}

export function clearMerchantAvatar(scope: MerchantAvatarScope): void {
  try {
    window.localStorage.removeItem(storageKey(scope));
  } catch {
    // 存储不可用时无可清理内容，下次进入仍显示默认头像。
  }
}