import { ApiError } from '../../../shared/apiClient';
import { buildApiUrl, getApiBaseUrl } from '../../../shared/config';
import type {
  CancelRequestStatus,
  CrowdBasis,
  CrowdLevel,
  CrowdReference,
  DiningMode,
  DishAddOn,
  DishDto,
  DishFlavorGroup,

  DishSide,
  MenuResponse,
  OrderDelay,
  OrderItem,
  OrderItemCustomization,
  OrderStatus,
  PaymentStatus,
  ShopSummary,
  SlotDto,
  StudentOrder,
} from '../types';

/**
 * 真实服务字段 → 学生模块字段映射表（契约 DRAFT v0.3）。
 *
 * | 真实 GET /menu 字段 | 学生模块字段 |
 * | --- | --- |
 * | slots[].id | SlotDto.slotId |
 * | slots[].startAt | SlotDto.slotStart |
 * | slots[].endAt | SlotDto.slotEnd |
 * | slots[].remainingCapacity | SlotDto.remainingCapacity（原样） |
 * | slots[].enabled | SlotDto.enabled（原样） |
 * | dishes[].id | DishDto.dishId |
 * | dishes[].merchantId | DishDto.merchantId（必填） |
 * | dishes[].priceFen | DishDto.unitPriceFen |
 * | dishes[].name | DishDto.name（原样） |
 * | dishes[].availableQuantity | DishDto.availableQuantity（原样） |
 * | dishes[].onSale | DishDto.onSale（原样） |
 *
 * 订单响应（GET /orders/{id}、POST /orders）使用 dishId/unitPriceFen/slotStart/slotEnd，
 * 与学生模块 StudentOrder 已对齐，不需要改名；订单映射在 S10 接入时只做字段校验。
 */
export const MENU_FIELD_MAPPING = {
  slots: {
    id: 'slotId',
    startAt: 'slotStart',
    endAt: 'slotEnd',
    remainingCapacity: 'remainingCapacity',
    enabled: 'enabled',
  },
  dishes: {
    id: 'dishId',
    merchantId: 'merchantId',
    priceFen: 'unitPriceFen',
    name: 'name',
    availableQuantity: 'availableQuantity',
    onSale: 'onSale',
  },
} as const;

export const ORDER_FIELD_MAPPING = {
  direct: ['dishId', 'unitPriceFen', 'slotStart', 'slotEnd'],
  note: '订单响应字段与 StudentOrder 已对齐，直接读取，不做二次改名。',
} as const;

export interface RealMenuDishPayload {
  id: string;
  merchantId?: string;
  name: string;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
}

export interface RealMenuSlotPayload {
  id: string;
  date?: string;
  startAt: string;
  endAt: string;
  capacity?: number;
  booked?: number;
  remainingCapacity: number;
  enabled: boolean;
}

export interface RealMenuPayload {
  date: string;
  dishes: RealMenuDishPayload[];
  slots: RealMenuSlotPayload[];
  demo?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) {
    const base = getApiBaseUrl();
    if (base) {
      try {
        return `${new URL(base).origin}${trimmed}`;
      } catch {
        // 落到下面按相对接口路径处理
      }
    }
    return trimmed;
  }
  return buildApiUrl(trimmed) ?? trimmed;
}

function optionalArray(record: Record<string, unknown>, field: string, where: string): unknown[] {
  const value = record[field];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    invalidResponse(`${where} 字段 ${field} 必须是数组。`);
  }
  return value;
}

function optionalPriceFen(record: Record<string, unknown>, where: string): number {
  const value = record.priceFen;
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalidResponse(`${where} 字段 priceFen 必须是非负整数。`);
  }
  return value;
}

function parseFlavorGroups(value: unknown[], where: string): DishFlavorGroup[] {
  return value.map((raw, index) => {
    const groupWhere = `${where} flavorGroups[${index}]`;
    if (!isRecord(raw)) {
      invalidResponse(`${groupWhere} 不是对象。`);
    }
    const options = optionalArray(raw, 'options', groupWhere).map((rawOption, optionIndex) => {
      const optionWhere = `${groupWhere} options[${optionIndex}]`;
      if (!isRecord(rawOption)) {
        invalidResponse(`${optionWhere} 不是对象。`);
      }
      return {
        id: requireText(rawOption, 'id', optionWhere),
        name: requireText(rawOption, 'name', optionWhere),
        priceFen: optionalPriceFen(rawOption, optionWhere),
      };
    });
    return {
      id: requireText(raw, 'id', groupWhere),
      name: requireText(raw, 'name', groupWhere),
      required: raw.required === undefined ? true : requireBoolean(raw, 'required', groupWhere),
      options,
    };
  });
}

function parseSides(value: unknown[], where: string): DishSide[] {
  return value.map((raw, index) => {
    const sideWhere = `${where} sides[${index}]`;
    if (!isRecord(raw)) {
      invalidResponse(`${sideWhere} 不是对象。`);
    }
    return {
      id: requireText(raw, 'id', sideWhere),
      name: requireText(raw, 'name', sideWhere),
      priceFen: optionalPriceFen(raw, sideWhere),
    };
  });
}

function parseAddOns(value: unknown[], where: string): DishAddOn[] {
  return value.map((raw, index) => {
    const addOnWhere = `${where} addOns[${index}]`;
    if (!isRecord(raw)) {
      invalidResponse(`${addOnWhere} 不是对象。`);
    }
    return {
      id: requireText(raw, 'id', addOnWhere),
      name: requireText(raw, 'name', addOnWhere),
      priceFen: optionalPriceFen(raw, addOnWhere),
    };
  });
}

function parseItemCustomization(value: unknown, where: string): OrderItemCustomization | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    invalidResponse(`${where} 字段 customization 必须是对象或 null。`);
  }
  const flavorSelections = optionalArray(value, 'flavorSelections', where).map((raw, index) => {
    const entryWhere = `${where} flavorSelections[${index}]`;
    if (!isRecord(raw)) {
      invalidResponse(`${entryWhere} 不是对象。`);
    }
    return {
      groupId: requireText(raw, 'groupId', entryWhere),
      groupName: requireText(raw, 'groupName', entryWhere),
      optionId: requireText(raw, 'optionId', entryWhere),
      optionName: requireText(raw, 'optionName', entryWhere),
    };
  });
  const sides = optionalArray(value, 'sides', where).map((raw, index) => {
    const entryWhere = `${where} sides[${index}]`;
    if (!isRecord(raw)) {
      invalidResponse(`${entryWhere} 不是对象。`);
    }
    return { id: requireText(raw, 'id', entryWhere), name: requireText(raw, 'name', entryWhere) };
  });
  const addOns = optionalArray(value, 'addOns', where).map((raw, index) => {
    const entryWhere = `${where} addOns[${index}]`;
    if (!isRecord(raw)) {
      invalidResponse(`${entryWhere} 不是对象。`);
    }
    return {
      id: requireText(raw, 'id', entryWhere),
      name: requireText(raw, 'name', entryWhere),
      priceFen: requireCount(raw, 'priceFen', entryWhere),
    };
  });
  return { flavorSelections, sides, addOns };
}

function invalidResponse(message: string): never {
  throw new ApiError({ code: 'INVALID_RESPONSE', message, status: 0, retryable: false });
}

function requireText(record: Record<string, unknown>, field: string, where: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim() === '') {
    invalidResponse(`${where} 缺少有效字段 ${field}。`);
  }
  return value;
}

function requireCount(record: Record<string, unknown>, field: string, where: string): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalidResponse(`${where} 字段 ${field} 必须是非负整数。`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string, where: string): boolean {
  const value = record[field];
  if (typeof value !== 'boolean') {
    invalidResponse(`${where} 字段 ${field} 必须是布尔值。`);
  }
  return value;
}

function requireArray(record: Record<string, unknown>, field: string): unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    invalidResponse(`菜单响应缺少 ${field} 数组。`);
  }
  return value;
}

/**
 * 把真实 GET /menu 响应映射为学生模块结构，并严格校验字段。
 * 任何缺字段、类型错误都抛 shared ApiError('INVALID_RESPONSE')，不回退样例数据。
 */
export function mapMenuResponse(payload: unknown): MenuResponse {
  if (!isRecord(payload)) {
    invalidResponse('菜单响应不是对象。');
  }

  const date = requireText(payload, 'date', '菜单响应');
  const dishes = requireArray(payload, 'dishes').map((entry, index): DishDto => {
    if (!isRecord(entry)) {
      invalidResponse(`菜单响应 dishes[${index}] 不是对象。`);
    }
    const where = `菜单响应 dishes[${index}]`;
    const merchantId = entry.merchantId;
    if (typeof merchantId !== 'string' || merchantId.trim() === '') {
      invalidResponse('服务端未提供菜品所属店铺，无法按店铺展示。');
    }
    return {
      dishId: requireText(entry, 'id', where),
      merchantId,
      name: requireText(entry, 'name', where),
      unitPriceFen: requireCount(entry, 'priceFen', where),
      availableQuantity: requireCount(entry, 'availableQuantity', where),
      onSale: requireBoolean(entry, 'onSale', where),
      imageUrl: optionalImageUrl(entry.imageUrl),
      flavorGroups: parseFlavorGroups(optionalArray(entry, 'flavorGroups', where), where),
      sides: parseSides(optionalArray(entry, 'sides', where), where),
      addOns: parseAddOns(optionalArray(entry, 'addOns', where), where),
    };
  });

  const slots = requireArray(payload, 'slots').map((entry, index): SlotDto => {
    if (!isRecord(entry)) {
      invalidResponse(`菜单响应 slots[${index}] 不是对象。`);
    }
    const where = `菜单响应 slots[${index}]`;
    return {
      slotId: requireText(entry, 'id', where),
      slotStart: requireText(entry, 'startAt', where),
      slotEnd: requireText(entry, 'endAt', where),
      remainingCapacity: requireCount(entry, 'remainingCapacity', where),
      enabled: requireBoolean(entry, 'enabled', where),
    };
  });

  return {
    date,
    // 真实响应没有 demo 字段或为 false 时，一律按真实数据处理，不伪造“演示数据”。
    demo: payload.demo === true,
    dishes,
    slots,
  };
}
export interface MapShopListOptions {
  demo: boolean;
}

function readNullableText(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readNullableBoolean(record: Record<string, unknown>, field: string): boolean | null {
  const value = record[field];
  return typeof value === 'boolean' ? value : null;
}

function readNullableInteger(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readOrderNo(record: Record<string, unknown>): number | null {
  const value = record.orderNo;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * 店铺列表响应映射。契约 DRAFT v0.3 尚未定义该接口，形状为建议值，
 * 兼容 { data: { merchants: [] } } 与 { merchants: [] }；契约确认后只改此处。
 */
export function mapShopListResponse(payload: unknown, { demo }: MapShopListOptions): ShopSummary[] {
  if (!isRecord(payload)) {
    invalidResponse('店铺列表响应不是对象。');
  }
  const container = isRecord(payload.data) ? payload.data : payload;
  const merchants = container.merchants;
  if (!Array.isArray(merchants)) {
    invalidResponse('店铺列表响应缺少 merchants 数组。');
  }
  return merchants.map((entry, index): ShopSummary => {
    if (!isRecord(entry)) {
      invalidResponse(`店铺列表响应 merchants[${index}] 不是对象。`);
    }
    const where = `店铺列表响应 merchants[${index}]`;
    return {
      merchantId: requireText(entry, 'merchantId', where),
      name: requireText(entry, 'name', where),
      canteenId: readNullableText(entry, 'canteenId'),
      orderable: readNullableBoolean(entry, 'orderable'),
      demo,
      sortOrder: readNullableInteger(entry, 'sortOrder'),
    };
  });
}

export const CROWD_FIELD_MAPPING = {
  direct: [
    'canteenId',
    'slotId',
    'referenceScope',
    'reservedDineInUsers',
    'currentReferenceUsers',
    'level',
    'basis',
    'updatedAt',
    'expiresAt',
    'demo',
    'message',
  ],
  note: '拥挤响应字段与 CrowdReference 已对齐，直接读取，不做二次改名。',
} as const;

const CROWD_LEVELS: CrowdLevel[] = ['CROWDED', 'NO_ALERT', 'UNKNOWN'];
const CROWD_BASIS: CrowdBasis[] = ['RESERVATION', 'LOCATION', 'PICKUP'];

function requireLooseText(record: Record<string, unknown>, field: string, where: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    invalidResponse(`${where} 字段 ${field} 必须是字符串。`);
  }
  return value;
}

function requireNullableCount(
  record: Record<string, unknown>,
  field: string,
  where: string,
): number | null {
  const value = record[field];
  if (value === null || value === undefined) {
    return null;
  }
  return requireCount(record, field, where);
}

export function mapCrowdResponse(payload: unknown): CrowdReference {
  if (!isRecord(payload)) {
    invalidResponse('拥挤参考响应不是对象。');
  }

  const where = '拥挤参考响应';

  if (payload.referenceScope !== 'PLATFORM_ONLY') {
    invalidResponse('拥挤参考响应的 referenceScope 必须为 PLATFORM_ONLY。');
  }

  const level = payload.level;
  if (typeof level !== 'string' || !CROWD_LEVELS.includes(level as CrowdLevel)) {
    invalidResponse('拥挤参考响应的 level 必须是 CROWDED / NO_ALERT / UNKNOWN 之一。');
  }

  const basis = requireArray(payload, 'basis').map((entry, index): CrowdBasis => {
    if (typeof entry !== 'string' || !CROWD_BASIS.includes(entry as CrowdBasis)) {
      invalidResponse(`拥挤参考响应 basis[${index}] 必须是 RESERVATION / LOCATION / PICKUP 之一。`);
    }
    return entry as CrowdBasis;
  });

  return {
    canteenId: requireText(payload, 'canteenId', where),
    slotId: requireText(payload, 'slotId', where),
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: requireNullableCount(payload, 'reservedDineInUsers', where),
    currentReferenceUsers: requireNullableCount(payload, 'currentReferenceUsers', where),
    level: level as CrowdLevel,
    basis,
    updatedAt: requireText(payload, 'updatedAt', where),
    expiresAt: requireText(payload, 'expiresAt', where),
    demo: payload.demo === true,
    message: requireLooseText(payload, 'message', where),
  };
}
export const ORDER_RESPONSE_FIELDS = {
  required: [
    'id',
    'items',
    'slotId',
    'slotStart',
    'slotEnd',
    'diningMode',
    'totalFen',
    'status',
    'paymentStatus',
    'cancelRequest',
    'cancellationReason',
    'version',
    'createdAt',
    'updatedAt',
    'pickedUpAt',
    'delay',
    'pickupCode',
  ],
  itemRequired: ['dishId', 'name', 'quantity', 'unitPriceFen'],
  ignored: ['demo', 'diningModeReason'],
  optionalShop: ['merchantId', 'merchantName'],
  note: '服务端订单响应无 demo 字段，demo 按数据来源注入；店铺字段过渡期可选解析，额外字段忽略不报错。',
} as const;

/** 契约确认订单店铺字段为必填后改为 true，并把读取改为 requireText。 */
export const ORDER_SHOP_STRICT = false;

const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
];
const PAYMENT_STATUSES: PaymentStatus[] = ['SIMULATED_PAID', 'SIMULATED_REFUNDED'];
const CANCEL_STATUSES: CancelRequestStatus[] = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'];
const ORDER_DINING_MODES: DiningMode[] = ['DINE_IN', 'TAKEAWAY'];

export interface MapOrderOptions {
  demo: boolean;
  where?: string;
}

function requireEnum<T extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  where: string,
): T {
  const value = record[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    invalidResponse(`${where} 字段 ${field} 必须是 ${allowed.join(' / ')} 之一。`);
  }
  return value as T;
}

function requireNullableText(
  record: Record<string, unknown>,
  field: string,
  where: string,
): string | null {
  const value = record[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    invalidResponse(`${where} 字段 ${field} 必须是字符串或 null。`);
  }
  return value;
}

function requireOrderItems(record: Record<string, unknown>, where: string): OrderItem[] {
  const value = record.items;
  if (!Array.isArray(value) || value.length === 0) {
    invalidResponse(`${where} 缺少非空 items 数组。`);
  }
  return value.map((entry, index): OrderItem => {
    if (!isRecord(entry)) {
      invalidResponse(`${where} items[${index}] 不是对象。`);
    }
    const itemWhere = `${where} items[${index}]`;
    const quantity = entry.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      invalidResponse(`${itemWhere} 字段 quantity 必须是正整数。`);
    }
    return {
      dishId: requireText(entry, 'dishId', itemWhere),
      name: requireText(entry, 'name', itemWhere),
      quantity,
      unitPriceFen: requireCount(entry, 'unitPriceFen', itemWhere),
      customization: parseItemCustomization(entry.customization, itemWhere),
    };
  });
}

function requireDelay(
  record: Record<string, unknown>,
  field: string,
  where: string,
): OrderDelay | null {
  const value = record[field];
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    invalidResponse(`${where} 字段 ${field} 必须是对象或 null。`);
  }
  return {
    reason: requireNullableText(value, 'reason', `${where} ${field}`),
    expectedReadyAt: requireText(value, 'expectedReadyAt', `${where} ${field}`),
  };
}

/**
 * 把真实订单响应映射为 StudentOrder 并严格校验字段。
 * 真实订单响应没有 demo 字段，demo 只取 options.demo，不读 payload；
 * 金额原样返回（totalFen / unitPriceFen 不重算），额外字段忽略。
 */
export function mapOrderResponse(payload: unknown, options: MapOrderOptions): StudentOrder {
  if (!isRecord(payload)) {
    invalidResponse('订单响应不是对象。');
  }
  const where = options.where ?? '订单响应';
  const items = requireOrderItems(payload, where);
  const cancelRequest = payload.cancelRequest;
  if (!isRecord(cancelRequest)) {
    invalidResponse(`${where} 缺少有效字段 cancelRequest。`);
  }
  const cancelWhere = `${where} cancelRequest`;

  return {
    id: requireText(payload, 'id', where),
    orderNo: readOrderNo(payload),
    merchantId: readNullableText(payload, 'merchantId'),
    merchantName: readNullableText(payload, 'merchantName'),
    items,
    slotId: requireText(payload, 'slotId', where),
    slotStart: requireText(payload, 'slotStart', where),
    slotEnd: requireText(payload, 'slotEnd', where),
    diningMode: requireEnum(payload, 'diningMode', ORDER_DINING_MODES, where),
    totalFen: requireCount(payload, 'totalFen', where),
    status: requireEnum(payload, 'status', ORDER_STATUSES, where),
    paymentStatus: requireEnum(payload, 'paymentStatus', PAYMENT_STATUSES, where),
    cancelRequest: {
      status: requireEnum(cancelRequest, 'status', CANCEL_STATUSES, cancelWhere),
      reason: requireNullableText(cancelRequest, 'reason', cancelWhere),
    },
    cancellationReason: requireNullableText(payload, 'cancellationReason', where),
    version: requireCount(payload, 'version', where),
    createdAt: requireText(payload, 'createdAt', where),
    updatedAt: requireText(payload, 'updatedAt', where),
    pickedUpAt: requireNullableText(payload, 'pickedUpAt', where),
    delay: requireDelay(payload, 'delay', where),
    pickupCode: requireNullableText(payload, 'pickupCode', where),
    demo: options.demo,
    remark: readNullableText(payload, 'remark'),
  };
}
export interface MapOrdersOptions {
  where?: string;
}

/**
 * 把学生订单列表响应映射为 StudentOrder[]，逐项复用 mapOrderResponse。
 * 不排序、不去重、不截断；任一元素非法则整体按 INVALID_RESPONSE 失败。
 */
export function mapOrdersResponse(
  payload: unknown,
  options: MapOrdersOptions = {},
): StudentOrder[] {
  if (!isRecord(payload)) {
    invalidResponse('订单列表响应不是对象。');
  }
  const where = options.where ?? '订单列表';
  const orders = payload.orders;
  if (!Array.isArray(orders)) {
    invalidResponse(`${where} 缺少 orders 数组。`);
  }
  return orders.map((entry, index) =>
    mapOrderResponse(entry, { demo: false, where: `${where} orders[${index}]` }),
  );
}