export interface DishPatch {
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
}

export interface SlotPatch {
  capacity: number;
  enabled: boolean;
}

export type PatchResult<T> =
  | { ok: true; patch: T }
  | { ok: false; error: string };

export function parseDishPatch(
  priceText: string,
  quantityText: string,
  onSale: boolean,
): PatchResult<DishPatch> {
  const price = priceText.trim();
  const quantity = quantityText.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(price)) {
    return { ok: false, error: '价格必须是元，最多两位小数。' };
  }
  const priceFen = Math.round(Number(price) * 100);
  if (!Number.isSafeInteger(priceFen) || priceFen > 1_000_000) {
    return { ok: false, error: '价格必须在 0—10000 元之间。' };
  }
  if (!/^\d+$/.test(quantity)) {
    return { ok: false, error: '可售数量必须是 0 或正整数。' };
  }
  const availableQuantity = Number(quantity);
  if (!Number.isSafeInteger(availableQuantity) || availableQuantity > 10_000) {
    return { ok: false, error: '可售数量不能超过 10000。' };
  }
  return { ok: true, patch: { priceFen, availableQuantity, onSale } };
}

export function parseSlotPatch(
  capacityText: string,
  occupied: number,
  enabled: boolean,
): PatchResult<SlotPatch> {
  const text = capacityText.trim();
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: '接单名额必须是 0 或正整数。' };
  }
  const capacity = Number(text);
  if (!Number.isSafeInteger(capacity) || capacity > 10_000) {
    return { ok: false, error: '接单名额不能超过 10000。' };
  }
  if (capacity < occupied) {
    return { ok: false, error: `接单名额不能低于已占用 ${occupied} 笔。` };
  }
  return { ok: true, patch: { capacity, enabled } };
}

export function menuWriteErrorText(code: string, message: string): string {
  switch (code) {
    case 'MENU_VERSION_MISSING':
      return '服务端未返回 version，暂时无法安全保存；已记录给后端补字段。';
    case 'ORDER_VERSION_CONFLICT':
      return '内容已被其他操作更新，请重新读取菜单后再保存。';
    case 'UNAUTHENTICATED':
    case 'SESSION_EXPIRED':
      return '登录已失效，请重新登录档口演示账号。';
    case 'NETWORK_TIMEOUT':
      return '请求超时，结果待确认；可直接重试，编辑会话会复用同一 requestId。';
    case 'API_BASE_NOT_CONFIGURED':
      return '尚未配置服务地址，请到 #/system-check 配置后再试。';
    default:
      return message;
  }
}

export function canEditVersion(version: number | null): boolean {
  return typeof version === 'number' && Number.isFinite(version);
}