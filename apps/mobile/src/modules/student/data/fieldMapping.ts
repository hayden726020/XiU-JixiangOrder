import { ApiError } from '../../../shared/apiClient';
import type {
  CancelRequestStatus,
  CrowdBasis,
  CrowdLevel,
  CrowdReference,
  DiningMode,
  DishDto,
  MenuResponse,
  OrderDelay,
  OrderItem,
  OrderStatus,
  PaymentStatus,
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
    return {
      dishId: requireText(entry, 'id', where),
      name: requireText(entry, 'name', where),
      unitPriceFen: requireCount(entry, 'priceFen', where),
      availableQuantity: requireCount(entry, 'availableQuantity', where),
      onSale: requireBoolean(entry, 'onSale', where),
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
  ignored: ['demo', 'diningModeReason', 'merchantId'],
  note: '服务端订单响应无 demo 字段，demo 按数据来源注入；额外字段忽略不报错。',
} as const;

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
  };
}