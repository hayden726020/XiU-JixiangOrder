import type {
  DishCustomization,
  DishCustomizationDraft,
  DishFlavorGroup,
  DishOption,
} from '../data/types';

export const CUSTOMIZATION_STORAGE_KEY = 'merchant.dish-customization.v1';

export const CUSTOMIZATION_LIMITS = {
  maxGroups: 4,
  maxOptionsPerGroup: 8,
  maxSides: 10,
  maxAddOns: 10,
  maxGroupName: 10,
  maxOptionName: 10,
  maxAddOnPriceFen: 10_000,
  maxImageBytes: 1_200_000,
} as const;

let idSeed = 0;

export function createCustomizationId(prefix: string): string {
  idSeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeed.toString(36)}`;
}

export function emptyCustomizationDraft(): DishCustomizationDraft {
  return { imageUrl: null, flavorGroups: [], sides: [], addOns: [] };
}

export function customizationToDraft(value: DishCustomization | null | undefined): DishCustomizationDraft {
  if (!value) return emptyCustomizationDraft();
  return {
    imageUrl: value.imageUrl,
    flavorGroups: value.flavorGroups.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      options: group.options.map((option) => ({ id: option.id, name: option.name })),
    })),
    sides: value.sides.map((side) => ({ id: side.id, name: side.name })),
    addOns: value.addOns.map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      priceText: (addOn.priceFen / 100).toFixed(2),
    })),
  };
}

export function emptyCustomization(): DishCustomization {
  return { imageUrl: null, flavorGroups: [], sides: [], addOns: [] };
}

function textLength(value: string): number {
  return Array.from(value).length;
}

function parsePriceFen(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const fen = Math.round(Number(trimmed) * 100);
  if (!Number.isSafeInteger(fen) || fen < 0 || fen > CUSTOMIZATION_LIMITS.maxAddOnPriceFen) {
    return null;
  }
  return fen;
}

export type CustomizationResult =
  | { ok: true; value: DishCustomization }
  | { ok: false; error: string };

export function validateCustomizationDraft(draft: DishCustomizationDraft): CustomizationResult {
  if (draft.imageUrl && draft.imageUrl.length > CUSTOMIZATION_LIMITS.maxImageBytes) {
    return { ok: false, error: '图片压缩后仍然过大，请换一张更小的图片。' };
  }
  if (draft.flavorGroups.length > CUSTOMIZATION_LIMITS.maxGroups) {
    return { ok: false, error: `口味特征最多 ${CUSTOMIZATION_LIMITS.maxGroups} 组。` };
  }

  const flavorGroups: DishFlavorGroup[] = [];
  const groupNames = new Set<string>();
  for (const group of draft.flavorGroups) {
    const groupName = group.name.trim();
    if (groupName.length < 1 || textLength(groupName) > CUSTOMIZATION_LIMITS.maxGroupName) {
      return { ok: false, error: `特征组名称需为 1—${CUSTOMIZATION_LIMITS.maxGroupName} 个字符。` };
    }
    if (groupNames.has(groupName)) {
      return { ok: false, error: `特征组「${groupName}」重复了，请改名。` };
    }
    groupNames.add(groupName);
    if (group.options.length < 1) {
      return { ok: false, error: `特征组「${groupName}」还没有选项，请至少添加一个。` };
    }
    if (group.options.length > CUSTOMIZATION_LIMITS.maxOptionsPerGroup) {
      return { ok: false, error: `特征组「${groupName}」最多 ${CUSTOMIZATION_LIMITS.maxOptionsPerGroup} 个选项。` };
    }
    const optionNames = new Set<string>();
    const options: DishOption[] = [];
    for (const option of group.options) {
      const optionName = option.name.trim();
      if (optionName.length < 1 || textLength(optionName) > CUSTOMIZATION_LIMITS.maxOptionName) {
        return { ok: false, error: `「${groupName}」的选项名称需为 1—${CUSTOMIZATION_LIMITS.maxOptionName} 个字符。` };
      }
      if (optionNames.has(optionName)) {
        return { ok: false, error: `「${groupName}」中的选项「${optionName}」重复了。` };
      }
      optionNames.add(optionName);
      options.push({ id: option.id, name: optionName, priceFen: 0 });
    }
    flavorGroups.push({ id: group.id, name: groupName, required: group.required, options });
  }

  if (draft.sides.length > CUSTOMIZATION_LIMITS.maxSides) {
    return { ok: false, error: `固定配菜最多 ${CUSTOMIZATION_LIMITS.maxSides} 项。` };
  }
  const sides: DishOption[] = [];
  const sideNames = new Set<string>();
  for (const side of draft.sides) {
    const sideName = side.name.trim();
    if (sideName.length < 1 || textLength(sideName) > CUSTOMIZATION_LIMITS.maxOptionName) {
      return { ok: false, error: `固定配菜名称需为 1—${CUSTOMIZATION_LIMITS.maxOptionName} 个字符。` };
    }
    if (sideNames.has(sideName)) {
      return { ok: false, error: `固定配菜「${sideName}」重复了。` };
    }
    sideNames.add(sideName);
    sides.push({ id: side.id, name: sideName, priceFen: 0 });
  }

  if (draft.addOns.length > CUSTOMIZATION_LIMITS.maxAddOns) {
    return { ok: false, error: `加购项最多 ${CUSTOMIZATION_LIMITS.maxAddOns} 项。` };
  }
  const addOns: DishOption[] = [];
  const addOnNames = new Set<string>();
  for (const addOn of draft.addOns) {
    const addOnName = addOn.name.trim();
    if (addOnName.length < 1 || textLength(addOnName) > CUSTOMIZATION_LIMITS.maxOptionName) {
      return { ok: false, error: `加购项名称需为 1—${CUSTOMIZATION_LIMITS.maxOptionName} 个字符。` };
    }
    if (addOnNames.has(addOnName)) {
      return { ok: false, error: `加购项「${addOnName}」重复了。` };
    }
    addOnNames.add(addOnName);
    const priceFen = parsePriceFen(addOn.priceText);
    if (priceFen === null) {
      return { ok: false, error: `「${addOnName}」的加价需为 0—100 元，最多两位小数。` };
    }
    addOns.push({ id: addOn.id, name: addOnName, priceFen });
  }

  return {
    ok: true,
    value: {
      imageUrl: draft.imageUrl,
      flavorGroups,
      sides,
      addOns,
    },
  };
}

export function customizationBadge(value: DishCustomization | null | undefined): string {
  if (!value) return '';
  const parts: string[] = [];
  if (value.flavorGroups.length > 0) parts.push(`${value.flavorGroups.length} 组特征`);
  if (value.sides.length > 0) parts.push(`${value.sides.length} 项配菜`);
  if (value.addOns.length > 0) parts.push(`${value.addOns.length} 项加购`);
  return parts.join(' · ');
}

export function hasCustomization(value: DishCustomization | null | undefined): boolean {
  if (!value) return false;
  return Boolean(value.imageUrl)
    || value.flavorGroups.length > 0
    || value.sides.length > 0
    || value.addOns.length > 0;
}

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function isOption(value: unknown): value is DishOption {
  if (typeof value !== 'object' || value === null) return false;
  const option = value as Partial<DishOption>;
  return typeof option.id === 'string'
    && typeof option.name === 'string'
    && typeof option.priceFen === 'number'
    && Number.isFinite(option.priceFen)
    && option.priceFen >= 0;
}

function isFlavorGroup(value: unknown): value is DishFlavorGroup {
  if (typeof value !== 'object' || value === null) return false;
  const group = value as Partial<DishFlavorGroup>;
  return typeof group.id === 'string'
    && typeof group.name === 'string'
    && typeof group.required === 'boolean'
    && Array.isArray(group.options)
    && group.options.every(isOption);
}

function isCustomization(value: unknown): value is DishCustomization {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<DishCustomization>;
  return (item.imageUrl === null || typeof item.imageUrl === 'string')
    && Array.isArray(item.flavorGroups)
    && item.flavorGroups.every(isFlavorGroup)
    && Array.isArray(item.sides)
    && item.sides.every(isOption)
    && Array.isArray(item.addOns)
    && item.addOns.every(isOption);
}

export function loadCustomizations(scope: 'sample' | 'real'): Record<string, DishCustomization> {
  if (!storageAvailable()) return {};
  try {
    const raw = window.localStorage.getItem(`${CUSTOMIZATION_STORAGE_KEY}:${scope}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Record<string, DishCustomization> = {};
    for (const [dishId, value] of Object.entries(parsed)) {
      if (isCustomization(value)) {
        result[dishId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveCustomizations(
  scope: 'sample' | 'real',
  value: Record<string, DishCustomization>,
): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(`${CUSTOMIZATION_STORAGE_KEY}:${scope}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}