import { ApiError } from '../../../shared/apiClient';
import type { DishDto, MenuResponse, SlotDto } from '../types';

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