import type { DishType } from '../data/types';
import type { SessionRole } from '../../../shared/session';

export type { DishType } from '../data/types';

const DISH_TYPE_VALUES = ['STAPLE', 'SNACK', 'DRINK', 'SET'] as const;

export const DISH_TYPE_OPTIONS: ReadonlyArray<{ value: DishType; label: string }> = [
  { value: 'STAPLE', label: '主食' },
  { value: 'SNACK', label: '小吃' },
  { value: 'DRINK', label: '饮品' },
  { value: 'SET', label: '套餐' },
];

export type OnboardingField =
  | 'merchantName'
  | 'contactName'
  | 'contactPhone'
  | 'shopName'
  | 'location'
  | 'description'
  | 'type'
  | 'name'
  | 'priceText'
  | 'quantityText';

export interface MerchantRegistrationDraft {
  merchantName: string;
  contactName: string;
  contactPhone: string;
}

export interface ShopDraft {
  shopName: string;
  location: string;
  description: string;
}

export interface NewDishDraft {
  type: DishType | '';
  name: string;
  priceText: string;
  quantityText: string;
}

export interface NewDishValue {
  type: DishType;
  name: string;
  priceFen: number;
  availableQuantity: number;
  onSale: true;
}

export type OnboardingErrors = Partial<Record<OnboardingField, string>>;

export type OnboardingResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: OnboardingErrors };

function trimText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizePhone(value: unknown): string {
  return trimText(value).replace(/[\s-]/g, '');
}

export function isDishType(value: unknown): value is DishType {
  return DISH_TYPE_VALUES.includes(value as DishType);
}

export function dishTypeLabel(type: DishType | null): string {
  return DISH_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? '未分类';
}

export function canUseOnboarding(
  role: SessionRole | null | undefined,
  merchantId: string | null | undefined,
  expiresAt: string | null | undefined = null,
): boolean {
  if (role !== 'MERCHANT' || typeof merchantId !== 'string' || merchantId.trim().length === 0) {
    return false;
  }
  if (typeof expiresAt === 'string') {
    const expires = Date.parse(expiresAt);
    if (Number.isNaN(expires) || expires <= Date.now()) {
      return false;
    }
  }
  return true;
}

export function validateMerchantRegistration(
  draft: MerchantRegistrationDraft,
): OnboardingResult<MerchantRegistrationDraft> {
  const errors: OnboardingErrors = {};
  const merchantName = trimText(draft.merchantName);
  const contactName = trimText(draft.contactName);
  const contactPhone = normalizePhone(draft.contactPhone);

  if (merchantName.length < 2 || merchantName.length > 30) {
    errors.merchantName = '商家名称需为 2—30 个字符。';
  }
  if (contactName.length < 2 || contactName.length > 20) {
    errors.contactName = '联系人需为 2—20 个字符。';
  }
  if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
    errors.contactPhone = '请输入 11 位手机号。';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { merchantName, contactName, contactPhone } };
}

export function validateShop(draft: ShopDraft): OnboardingResult<ShopDraft> {
  const errors: OnboardingErrors = {};
  const shopName = trimText(draft.shopName);
  const location = trimText(draft.location);
  const description = trimText(draft.description);

  if (shopName.length < 2 || shopName.length > 30) {
    errors.shopName = '店铺名称需为 2—30 个字符。';
  }
  if (location.length < 2 || location.length > 50) {
    errors.location = '档口位置需为 2—50 个字符。';
  }
  if (description.length > 100) {
    errors.description = '店铺简介不能超过 100 个字符。';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { shopName, location, description } };
}

export function validateNewDish(draft: NewDishDraft): OnboardingResult<NewDishValue> {
  const errors: OnboardingErrors = {};
  const name = trimText(draft.name);
  const price = trimText(draft.priceText);
  const quantity = trimText(draft.quantityText);

  if (!isDishType(draft.type)) {
    errors.type = '请选择菜品类型。';
  }
  if (name.length < 1 || name.length > 30) {
    errors.name = '菜品名称需为 1—30 个字符。';
  }

  let priceFen: number | null = null;
  if (!/^\d+(\.\d{1,2})?$/.test(price)) {
    errors.priceText = '价格必须是元，最多两位小数。';
  } else {
    priceFen = Math.round(Number(price) * 100);
    if (!Number.isSafeInteger(priceFen) || priceFen <= 0 || priceFen > 1_000_000) {
      errors.priceText = '价格必须在 0.01—10000 元之间。';
      priceFen = null;
    }
  }

  let availableQuantity: number | null = null;
  if (!/^\d+$/.test(quantity)) {
    errors.quantityText = '可售数量必须是 0 或正整数。';
  } else {
    availableQuantity = Number(quantity);
    if (!Number.isSafeInteger(availableQuantity) || availableQuantity > 10_000) {
      errors.quantityText = '可售数量不能超过 10000。';
      availableQuantity = null;
    }
  }

  if (Object.keys(errors).length > 0 || priceFen === null || availableQuantity === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      type: draft.type as DishType,
      name,
      priceFen,
      availableQuantity,
      onSale: true,
    },
  };
}