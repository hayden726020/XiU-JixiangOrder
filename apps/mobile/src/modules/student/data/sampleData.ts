import type { CrowdReference, DishDto, SlotDto, StudentOrder } from '../types';

export const DATES = ['2026-11-13', '2026-11-14'];

export interface SampleDish {
  dishId: string;
  name: string;
  unitPriceFen: number;
  availability: Record<string, number>;
  onSale: Record<string, boolean>;
}

export interface SampleSlot {
  slotId: string;
  date: string;
  start: string;
  end: string;
  capacity: number;
  occupied: number;
  enabled: boolean;
}

export const DISHES: SampleDish[] = [
  {
    dishId: 'demo-dish-01',
    name: '演示鸡肉饭',
    unitPriceFen: 1800,
    availability: { '2026-11-13': 40, '2026-11-14': 35 },
    onSale: { '2026-11-13': true, '2026-11-14': true },
  },
  {
    dishId: 'demo-dish-02',
    name: '演示番茄炒蛋',
    unitPriceFen: 900,
    availability: { '2026-11-13': 35, '2026-11-14': 30 },
    onSale: { '2026-11-13': true, '2026-11-14': true },
  },
  {
    dishId: 'demo-dish-03',
    name: '演示青椒肉丝',
    unitPriceFen: 1500,
    availability: { '2026-11-13': 0, '2026-11-14': 20 },
    onSale: { '2026-11-13': false, '2026-11-14': true },
  },
  {
    dishId: 'demo-dish-04',
    name: '演示紫菜蛋花汤',
    unitPriceFen: 500,
    availability: { '2026-11-13': 50, '2026-11-14': 45 },
    onSale: { '2026-11-13': true, '2026-11-14': true },
  },
  {
    dishId: 'demo-dish-05',
    name: '演示卤蛋',
    unitPriceFen: 300,
    availability: { '2026-11-13': 0, '2026-11-14': 10 },
    onSale: { '2026-11-13': true, '2026-11-14': true },
  },
];

export const SLOTS: SampleSlot[] = [
  { slotId: 'demo-slot-20261113-lunch', date: '2026-11-13', start: '11:30', end: '12:00', capacity: 30, occupied: 12, enabled: true },
  { slotId: 'demo-slot-20261113-late', date: '2026-11-13', start: '12:00', end: '12:30', capacity: 30, occupied: 18, enabled: true },
  { slotId: 'demo-slot-20261113-tail', date: '2026-11-13', start: '12:30', end: '13:00', capacity: 20, occupied: 20, enabled: true },
  { slotId: 'demo-slot-20261114-lunch', date: '2026-11-14', start: '11:30', end: '12:00', capacity: 30, occupied: 10, enabled: true },
  { slotId: 'demo-slot-20261114-late', date: '2026-11-14', start: '12:00', end: '12:30', capacity: 30, occupied: 5, enabled: true },
  { slotId: 'demo-slot-20261114-tail', date: '2026-11-14', start: '12:30', end: '13:00', capacity: 20, occupied: 20, enabled: true },
];

export const CROWD_REFERENCE: Record<string, CrowdReference> = {
  'demo-slot-20261113-lunch': {
    canteenId: 'demo-canteen-01',
    slotId: 'demo-slot-20261113-lunch',
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: 5,
    currentReferenceUsers: 3,
    level: 'CROWDED',
    basis: ['RESERVATION', 'LOCATION', 'PICKUP'],
    updatedAt: '2026-11-13T11:45:00+08:00',
    expiresAt: '2026-11-13T11:50:00+08:00',
    demo: true,
    message: '演示数据：当前堂食可能较拥挤。仍可选择堂食，不保证座位；仅为本平台参考。',
  },
  'demo-slot-20261113-late': {
    canteenId: 'demo-canteen-01',
    slotId: 'demo-slot-20261113-late',
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: 4,
    currentReferenceUsers: 2,
    level: 'NO_ALERT',
    basis: ['RESERVATION', 'LOCATION'],
    updatedAt: '2026-11-13T11:45:00+08:00',
    expiresAt: '2026-11-13T11:50:00+08:00',
    demo: true,
    message: '演示数据：暂未触发拥挤提醒，不代表有座位；仅为本平台参考。',
  },
  'demo-slot-20261113-tail': {
    canteenId: 'demo-canteen-01',
    slotId: 'demo-slot-20261113-tail',
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: null,
    currentReferenceUsers: null,
    level: 'UNKNOWN',
    basis: [],
    updatedAt: '2026-11-13T11:45:00+08:00',
    expiresAt: '2026-11-13T11:50:00+08:00',
    demo: true,
    message: '暂无足够信息判断堂食人数，请以现场为准。',
  },
  'demo-slot-20261114-lunch': {
    canteenId: 'demo-canteen-01',
    slotId: 'demo-slot-20261114-lunch',
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: 4,
    currentReferenceUsers: null,
    level: 'CROWDED',
    basis: ['RESERVATION'],
    updatedAt: '2026-11-13T11:45:00+08:00',
    expiresAt: '2026-11-13T11:50:00+08:00',
    demo: true,
    message: '演示数据：明天所选时段预约堂食需求较集中，不代表明天现场实测人数。',
  },
  'demo-slot-20261114-late': {
    canteenId: 'demo-canteen-01',
    slotId: 'demo-slot-20261114-late',
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: 2,
    currentReferenceUsers: null,
    level: 'NO_ALERT',
    basis: ['RESERVATION'],
    updatedAt: '2026-11-13T11:45:00+08:00',
    expiresAt: '2026-11-13T11:50:00+08:00',
    demo: true,
    message: '演示数据：明天所选时段预约堂食需求较少，不代表明天现场人数。',
  },
  'demo-slot-20261114-tail': {
    canteenId: 'demo-canteen-01',
    slotId: 'demo-slot-20261114-tail',
    referenceScope: 'PLATFORM_ONLY',
    reservedDineInUsers: null,
    currentReferenceUsers: null,
    level: 'UNKNOWN',
    basis: [],
    updatedAt: '2026-11-13T11:45:00+08:00',
    expiresAt: '2026-11-13T11:50:00+08:00',
    demo: true,
    message: '暂无足够信息判断堂食人数，请以现场为准。',
  },
};

export const DEMO_ORDER_001: StudentOrder = {
  id: 'demo-order-001',
  items: [{ dishId: 'demo-dish-01', name: '演示鸡肉饭', quantity: 1, unitPriceFen: 1800 }],
  slotId: 'demo-slot-20261113-lunch',
  slotStart: '2026-11-13T11:30:00+08:00',
  slotEnd: '2026-11-13T12:00:00+08:00',
  diningMode: 'DINE_IN',
  totalFen: 1800,
  status: 'NEW',
  paymentStatus: 'SIMULATED_PAID',
  cancelRequest: { status: 'NONE', reason: null },
  cancellationReason: null,
  version: 1,
  createdAt: '2026-11-13T11:15:00+08:00',
  updatedAt: '2026-11-13T11:15:00+08:00',
  pickedUpAt: null,
  delay: null,
  pickupCode: null,
  demo: true,
};

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function findDish(dishId: string): SampleDish | null {
  return DISHES.find((dish) => dish.dishId === dishId) ?? null;
}

export function findSlot(slotId: string): SampleSlot | null {
  return SLOTS.find((slot) => slot.slotId === slotId) ?? null;
}

export function toDishDto(dish: SampleDish, date: string): DishDto {
  return {
    dishId: dish.dishId,
    name: dish.name,
    unitPriceFen: dish.unitPriceFen,
    availableQuantity: dish.availability[date] ?? 0,
    onSale: dish.onSale[date] === true,
  };
}

export function toSlotDto(slot: SampleSlot): SlotDto {
  return {
    slotId: slot.slotId,
    slotStart: `${slot.date}T${slot.start}:00+08:00`,
    slotEnd: `${slot.date}T${slot.end}:00+08:00`,
    remainingCapacity: slot.capacity - slot.occupied,
    enabled: slot.enabled,
  };
}