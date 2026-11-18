import type { DishFlavorGroup, DishOption, DishType } from '../data/types';
import { isDishType } from './onboarding';

export interface DishPatch {
  name: string;
  type: DishType;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
  imageUrl?: string | null;
  flavorGroups?: DishFlavorGroup[];
  sides?: DishOption[];
  addOns?: DishOption[];
}

export type PatchResult<T> =
  | { ok: true; patch: T }
  | { ok: false; error: string };

export function parseDishPatch(
  nameText: string,
  typeText: DishType | '',
  priceText: string,
  quantityText: string,
  onSale: boolean,
): PatchResult<DishPatch> {
  const name = nameText.trim();
  const price = priceText.trim();
  const quantity = quantityText.trim();
  if (name.length < 1 || name.length > 30) {
    return { ok: false, error: '菜品名称需为 1—30 个字符。' };
  }
  if (!isDishType(typeText)) {
    return { ok: false, error: '请选择菜品类别。' };
  }
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
  return { ok: true, patch: { name, type: typeText, priceFen, availableQuantity, onSale } };
}

export function menuWriteErrorText(code: string, message: string): string {
  switch (code) {
    case 'MENU_VERSION_MISSING':
      return '服务端未返回 version，暂时无法安全保存；已记录给后端补字段。';
    case 'ORDER_VERSION_CONFLICT':
      return '内容已被其他操作更新，请重新读取菜单后再保存。';
    case 'DISH_NOT_FOUND':
      return '菜品不存在或已被删除，请重新读取菜单。';
    case 'DISH_IN_USE':
      return '该菜品存在未结束订单，暂不能删除；可先改为停售。';
    case 'SHOP_REQUIRED':
      return '请先完成商家注册与开店，再新增菜品。';
    case 'MERCHANT_REQUIRED':
      return '请先完成商家注册，再新增菜品。';
    case 'NOT_FOUND':
    case 'METHOD_NOT_ALLOWED':
    case 'UNSUPPORTED':
      return '服务端暂未提供该操作接口，请先联系后端补接口，或改用“停售”。';
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