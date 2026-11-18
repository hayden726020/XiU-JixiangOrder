import { validationError } from './errors.mjs';
import { asRecord, newId, requireInteger } from './util.mjs';

export const CUSTOMIZATION_LIMITS = {
  maxGroups: 4,
  maxOptionsPerGroup: 8,
  maxSides: 10,
  maxAddOns: 10,
  maxGroupName: 10,
  maxOptionName: 10,
  maxAddOnPriceFen: 10_000,
};

function textLength(value) {
  return Array.from(value).length;
}

function normalizeId(raw, prefix) {
  if (raw === undefined || raw === null) {
    return newId(prefix);
  }
  if (typeof raw !== 'string') {
    throw validationError('选项 id 必须是字符串。');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    throw validationError('选项 id 长度应在 1 到 80 之间。');
  }
  return trimmed;
}

function normalizeName(raw, label, maxLen) {
  if (typeof raw !== 'string') {
    throw validationError(`${label}必须是字符串。`);
  }
  const trimmed = raw.trim();
  const len = textLength(trimmed);
  if (len < 1 || len > maxLen) {
    throw validationError(`${label}需为 1—${maxLen} 个字符。`);
  }
  return trimmed;
}

export function parseFlavorGroups(value) {
  if (!Array.isArray(value)) {
    throw validationError('flavorGroups 必须是数组。');
  }
  if (value.length > CUSTOMIZATION_LIMITS.maxGroups) {
    throw validationError(`口味特征最多 ${CUSTOMIZATION_LIMITS.maxGroups} 组。`);
  }
  const groupNames = new Set();
  const groups = [];
  for (const rawGroup of value) {
    const group = asRecord(rawGroup);
    const name = normalizeName(group.name, '特征组名称', CUSTOMIZATION_LIMITS.maxGroupName);
    if (groupNames.has(name)) {
      throw validationError(`特征组「${name}」重复。`);
    }
    groupNames.add(name);
    if (group.required !== undefined && typeof group.required !== 'boolean') {
      throw validationError('flavorGroups[].required 必须是布尔值。');
    }
    const required = group.required ?? true;
    if (!Array.isArray(group.options) || group.options.length < 1) {
      throw validationError(`特征组「${name}」至少需要 1 个选项。`);
    }
    if (group.options.length > CUSTOMIZATION_LIMITS.maxOptionsPerGroup) {
      throw validationError(`特征组「${name}」最多 ${CUSTOMIZATION_LIMITS.maxOptionsPerGroup} 个选项。`);
    }
    const optionNames = new Set();
    const options = [];
    for (const rawOption of group.options) {
      const option = asRecord(rawOption);
      const optionName = normalizeName(
        option.name,
        `「${name}」选项名称`,
        CUSTOMIZATION_LIMITS.maxOptionName,
      );
      if (optionNames.has(optionName)) {
        throw validationError(`「${name}」中的选项「${optionName}」重复。`);
      }
      optionNames.add(optionName);
      const priceFen = option.priceFen === undefined
        ? 0
        : requireInteger(option.priceFen, 'flavorGroups[].options[].priceFen', {
            min: 0,
            max: CUSTOMIZATION_LIMITS.maxAddOnPriceFen,
          });
      options.push({ id: normalizeId(option.id, 'opt'), name: optionName, priceFen });
    }
    groups.push({ id: normalizeId(group.id, 'grp'), name, required, options });
  }
  return groups;
}

export function parseSides(value) {
  if (!Array.isArray(value)) {
    throw validationError('sides 必须是数组。');
  }
  if (value.length > CUSTOMIZATION_LIMITS.maxSides) {
    throw validationError(`固定配菜最多 ${CUSTOMIZATION_LIMITS.maxSides} 项。`);
  }
  const names = new Set();
  const sides = [];
  for (const rawSide of value) {
    const side = asRecord(rawSide);
    const name = normalizeName(side.name, '固定配菜名称', CUSTOMIZATION_LIMITS.maxOptionName);
    if (names.has(name)) {
      throw validationError(`固定配菜「${name}」重复。`);
    }
    names.add(name);
    if (side.priceFen !== undefined && side.priceFen !== 0) {
      throw validationError('固定配菜不额外加价，priceFen 必须为 0。');
    }
    sides.push({ id: normalizeId(side.id, 'side'), name, priceFen: 0 });
  }
  return sides;
}

export function parseAddOns(value) {
  if (!Array.isArray(value)) {
    throw validationError('addOns 必须是数组。');
  }
  if (value.length > CUSTOMIZATION_LIMITS.maxAddOns) {
    throw validationError(`加购项最多 ${CUSTOMIZATION_LIMITS.maxAddOns} 项。`);
  }
  const names = new Set();
  const addOns = [];
  for (const rawAddOn of value) {
    const addOn = asRecord(rawAddOn);
    const name = normalizeName(addOn.name, '加购项名称', CUSTOMIZATION_LIMITS.maxOptionName);
    if (names.has(name)) {
      throw validationError(`加购项「${name}」重复。`);
    }
    names.add(name);
    const priceFen = addOn.priceFen === undefined
      ? 0
      : requireInteger(addOn.priceFen, 'addOns[].priceFen', {
          min: 0,
          max: CUSTOMIZATION_LIMITS.maxAddOnPriceFen,
        });
    addOns.push({ id: normalizeId(addOn.id, 'addon'), name, priceFen });
  }
  return addOns;
}

export function safeParseJsonArray(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function customizationOfRow(row) {
  return {
    flavorGroups: safeParseJsonArray(row.flavor_groups_json),
    sides: safeParseJsonArray(row.sides_json),
    addOns: safeParseJsonArray(row.add_ons_json),
  };
}

export function resolveOrderItemCustomization(dishRow, rawItem) {
  const flavorGroups = safeParseJsonArray(dishRow.flavor_groups_json);
  const sides = safeParseJsonArray(dishRow.sides_json);
  const addOns = safeParseJsonArray(dishRow.add_ons_json);

  const hasSelections =
    rawItem.selectedFlavors !== undefined ||
    rawItem.selectedSides !== undefined ||
    rawItem.selectedAddOns !== undefined;

  const groupMap = new Map(flavorGroups.map((group) => [group.id, group]));
  const sideMap = new Map(sides.map((side) => [side.id, side]));
  const addOnMap = new Map(addOns.map((addOn) => [addOn.id, addOn]));

  const flavorSelections = [];
  const chosenGroupIds = new Set();
  if (rawItem.selectedFlavors !== undefined) {
    if (!Array.isArray(rawItem.selectedFlavors)) {
      throw validationError('selectedFlavors 必须是数组。');
    }
    for (const entry of rawItem.selectedFlavors) {
      const record = asRecord(entry);
      if (typeof record.groupId !== 'string' || typeof record.optionId !== 'string') {
        throw validationError('selectedFlavors[] 必须包含 groupId 和 optionId。');
      }
      if (chosenGroupIds.has(record.groupId)) {
        throw validationError('同一口味特征组只能选择一个选项。');
      }
      const group = groupMap.get(record.groupId);
      if (!group) {
        throw validationError(`口味特征组 ${record.groupId} 不属于该菜品。`);
      }
      const option = (group.options ?? []).find((opt) => opt.id === record.optionId);
      if (!option) {
        throw validationError(`口味选项 ${record.optionId} 不属于「${group.name}」。`);
      }
      chosenGroupIds.add(record.groupId);
      flavorSelections.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
      });
    }
  }

  for (const group of flavorGroups) {
    if (group.required && !chosenGroupIds.has(group.id)) {
      throw validationError(`请选择「${dishRow.name}」的必选口味「${group.name}」。`);
    }
  }

  const chosenSides = [];
  const chosenSideIds = new Set();
  if (rawItem.selectedSides !== undefined) {
    if (!Array.isArray(rawItem.selectedSides)) {
      throw validationError('selectedSides 必须是数组。');
    }
    for (const sideId of rawItem.selectedSides) {
      if (typeof sideId !== 'string' || chosenSideIds.has(sideId)) {
        throw validationError('selectedSides 必须是不重复的配菜 id 字符串数组。');
      }
      const side = sideMap.get(sideId);
      if (!side) {
        throw validationError(`配菜 ${sideId} 不属于该菜品。`);
      }
      chosenSideIds.add(sideId);
      chosenSides.push({ id: side.id, name: side.name });
    }
  }

  const chosenAddOns = [];
  const chosenAddOnIds = new Set();
  let extraUnitPriceFen = 0;
  if (rawItem.selectedAddOns !== undefined) {
    if (!Array.isArray(rawItem.selectedAddOns)) {
      throw validationError('selectedAddOns 必须是数组。');
    }
    for (const addOnId of rawItem.selectedAddOns) {
      if (typeof addOnId !== 'string' || chosenAddOnIds.has(addOnId)) {
        throw validationError('selectedAddOns 必须是不重复的加购 id 字符串数组。');
      }
      const addOn = addOnMap.get(addOnId);
      if (!addOn) {
        throw validationError(`加购项 ${addOnId} 不属于该菜品。`);
      }
      chosenAddOnIds.add(addOnId);
      extraUnitPriceFen += Math.max(0, addOn.priceFen ?? 0);
      chosenAddOns.push({ id: addOn.id, name: addOn.name, priceFen: addOn.priceFen ?? 0 });
    }
  }

  if (!hasSelections) {
    return { extraUnitPriceFen: 0, customization: null };
  }

  return {
    extraUnitPriceFen,
    customization: {
      flavorSelections,
      sides: chosenSides,
      addOns: chosenAddOns,
    },
  };
}