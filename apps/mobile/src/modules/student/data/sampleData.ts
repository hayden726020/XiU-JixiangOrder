import { addDays, toShanghaiDate } from '../utils/dates';
import type { CrowdReference, DishDto, ShopSummary, SlotDto, StudentOrder } from '../types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export const SAMPLE_DATE_RANGE_DAYS = 7;

export function sampleDates(base: Date = new Date()): string[] {
  const today = toShanghaiDate(base);
  return Array.from({ length: SAMPLE_DATE_RANGE_DAYS }, (_, index) => addDays(today, index));
}

export const DATES = sampleDates();

export const SLOT_DAY_START_HOUR = 8;
export const SLOT_DAY_END_HOUR = 22;

export const DEMO_SHOPS: ShopSummary[] = [
  {
    merchantId: 'demo-merchant-01',
    name: '一食堂·家常档',
    canteenId: 'demo-canteen-01',
    orderable: true,
    demo: true,
    sortOrder: 1,
  },
  {
    merchantId: 'demo-merchant-03',
    name: '一食堂·风味小炒',
    canteenId: 'demo-canteen-01',
    orderable: true,
    demo: true,
    sortOrder: 2,
  },
  {
    merchantId: 'demo-merchant-02',
    name: '一食堂·面档',
    canteenId: 'demo-canteen-01',
    orderable: true,
    demo: true,
    sortOrder: 3,
  },
];

export const DISH_SHOP: Record<string, string> = {
  'demo-dish-01': 'demo-merchant-01',
  'demo-dish-02': 'demo-merchant-02',
  'demo-dish-03': 'demo-merchant-03',
  'demo-dish-04': 'demo-merchant-01',
  'demo-dish-05': 'demo-merchant-01',
  'demo-dish-chicken': 'demo-merchant-03',
  'demo-dish-beef-noodle': 'demo-merchant-02',
  'demo-dish-tomato-egg': 'demo-merchant-01',
};

export const SAMPLE_ONLY_DISH_IDS = ['demo-dish-04', 'demo-dish-05'];

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

function availabilityFor(...values: number[]): Record<string, number> {
  return Object.fromEntries(
    DATES.map((date, index) => [date, values[index % values.length]]),
  );
}

function onSaleEveryDay(): Record<string, boolean> {
  return Object.fromEntries(DATES.map((date) => [date, true]));
}

export const DISHES: SampleDish[] = [
  {
    dishId: 'demo-dish-01',
    name: '演示鸡肉饭',
    unitPriceFen: 1800,
    availability: availabilityFor(40, 35),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-02',
    name: '演示番茄炒蛋',
    unitPriceFen: 900,
    availability: availabilityFor(35, 30),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-03',
    name: '演示青椒肉丝',
    unitPriceFen: 1500,
    availability: availabilityFor(25, 20),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-04',
    name: '演示紫菜蛋花汤',
    unitPriceFen: 500,
    availability: availabilityFor(50, 45),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-05',
    name: '演示卤蛋',
    unitPriceFen: 300,
    availability: availabilityFor(0, 10),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-chicken',
    name: '黑椒鸡腿饭',
    unitPriceFen: 1400,
    availability: availabilityFor(50, 50),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-beef-noodle',
    name: '红烧牛肉面',
    unitPriceFen: 1600,
    availability: availabilityFor(30, 30),
    onSale: onSaleEveryDay(),
  },
  {
    dishId: 'demo-dish-tomato-egg',
    name: '番茄炒蛋饭',
    unitPriceFen: 1200,
    availability: availabilityFor(40, 40),
    onSale: onSaleEveryDay(),
  },
];

const SLOT_STEP_MINUTES = 30;
const SLOT_CAPACITY = 30;
const OCCUPIED_PATTERN = [12, 18, 26, 30, 8, 5, 14, 22, 30, 10, 16, 24, 30, 9];

function buildSlots(dates: string[]): SampleSlot[] {
  const slots: SampleSlot[] = [];
  for (const date of dates) {
    const compact = date.split('-').join('');
    let index = 0;
    for (let hour = SLOT_DAY_START_HOUR; hour < SLOT_DAY_END_HOUR; hour += 1) {
      for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
        const endTotal = hour * 60 + minute + SLOT_STEP_MINUTES;
        index += 1;
        slots.push({
          slotId: `demo-slot-${compact}-${pad(hour)}${pad(minute)}`,
          date,
          start: `${pad(hour)}:${pad(minute)}`,
          end: `${pad(Math.floor(endTotal / 60))}:${pad(endTotal % 60)}`,
          capacity: SLOT_CAPACITY,
          occupied: OCCUPIED_PATTERN[(index - 1) % OCCUPIED_PATTERN.length],
          enabled: true,
        });
      }
    }
  }
  return slots;
}

export const SLOTS: SampleSlot[] = buildSlots(DATES);

function isoShanghai(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(
    shifted.getUTCHours(),
  )}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+08:00`;
}

const CROWD_UPDATED_AT = isoShanghai(new Date());
const CROWD_EXPIRES_AT = isoShanghai(new Date(Date.now() + 5 * 60 * 1000));

const CROWD_TEMPLATES: Array<{
  level: CrowdReference['level'];
  reserved: number | null;
  current: number | null;
  basis: CrowdReference['basis'];
  message: string;
}> = [
  {
    level: 'CROWDED',
    reserved: 5,
    current: 3,
    basis: ['RESERVATION', 'LOCATION', 'PICKUP'],
    message: '演示数据：当前堂食可能较拥挤。仍可选择堂食，不保证座位；仅为本平台参考。',
  },
  {
    level: 'NO_ALERT',
    reserved: 4,
    current: 2,
    basis: ['RESERVATION', 'LOCATION'],
    message: '演示数据：暂未触发拥挤提醒，不代表有座位；仅为本平台参考。',
  },
  {
    level: 'UNKNOWN',
    reserved: null,
    current: null,
    basis: [],
    message: '暂无足够信息判断堂食人数，请以现场为准。',
  },
];

function buildCrowdReference(slots: SampleSlot[]): Record<string, CrowdReference> {
  const reference: Record<string, CrowdReference> = {};
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const template = CROWD_TEMPLATES[index % CROWD_TEMPLATES.length];
    reference[slot.slotId] = {
      canteenId: 'demo-canteen-01',
      slotId: slot.slotId,
      referenceScope: 'PLATFORM_ONLY',
      reservedDineInUsers: template.reserved,
      currentReferenceUsers: template.current,
      level: template.level,
      basis: [...template.basis],
      updatedAt: CROWD_UPDATED_AT,
      expiresAt: CROWD_EXPIRES_AT,
      demo: true,
      message: template.message,
    };
  }
  return reference;
}

export const CROWD_REFERENCE: Record<string, CrowdReference> = buildCrowdReference(SLOTS);

export const DEMO_ORDER_001: StudentOrder = {
  id: 'demo-order-001',
  merchantId: 'demo-merchant-01',
  merchantName: '一食堂·家常档',
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

export const DEMO_ORDER_CANCEL_PENDING: StudentOrder = {
  id: 'demo-order-cancel-001',
  merchantId: 'demo-merchant-03',
  merchantName: '风味小炒',
  items: [{ dishId: 'demo-dish-chicken', name: '黑椒鸡腿饭', quantity: 1, unitPriceFen: 1400 }],
  slotId: 'demo-slot-20261113-late',
  slotStart: '2026-11-13T12:00:00+08:00',
  slotEnd: '2026-11-13T12:30:00+08:00',
  diningMode: 'DINE_IN',
  totalFen: 1400,
  status: 'PREPARING',
  paymentStatus: 'SIMULATED_PAID',
  cancelRequest: { status: 'PENDING', reason: '临时有事，无法取餐' },
  cancellationReason: null,
  version: 2,
  createdAt: '2026-11-13T10:15:00+08:00',
  updatedAt: '2026-11-13T10:24:00+08:00',
  pickedUpAt: null,
  delay: null,
  pickupCode: null,
  demo: true,
};

export const DEMO_ORDER_READY_001: StudentOrder = {
  id: 'demo-order-ready-001',
  merchantId: 'demo-merchant-03',
  merchantName: '风味小炒',
  items: [{ dishId: 'demo-dish-chicken', name: '黑椒鸡腿饭', quantity: 1, unitPriceFen: 1400 }],
  slotId: 'demo-slot-20261113-late',
  slotStart: '2026-11-13T12:00:00+08:00',
  slotEnd: '2026-11-13T12:30:00+08:00',
  diningMode: 'DINE_IN',
  totalFen: 1400,
  status: 'READY',
  paymentStatus: 'SIMULATED_PAID',
  cancelRequest: { status: 'NONE', reason: null },
  cancellationReason: null,
  version: 3,
  createdAt: '2026-11-13T11:20:00+08:00',
  updatedAt: '2026-11-13T11:45:00+08:00',
  pickedUpAt: null,
  delay: null,
  pickupCode: 'A 268',
  demo: true,
};

export const DEMO_ORDER_PREPARING_002: StudentOrder = {
  id: 'demo-order-prep-002',
  merchantId: 'demo-merchant-02',
  merchantName: '面食档',
  items: [{ dishId: 'demo-dish-beef-noodle', name: '红烧牛肉面', quantity: 1, unitPriceFen: 1600 }],
  slotId: 'demo-slot-20261113-tail',
  slotStart: '2026-11-13T12:30:00+08:00',
  slotEnd: '2026-11-13T13:00:00+08:00',
  diningMode: 'TAKEAWAY',
  totalFen: 1600,
  status: 'PREPARING',
  paymentStatus: 'SIMULATED_PAID',
  cancelRequest: { status: 'NONE', reason: null },
  cancellationReason: null,
  version: 2,
  createdAt: '2026-11-13T11:35:00+08:00',
  updatedAt: '2026-11-13T11:40:00+08:00',
  pickedUpAt: null,
  delay: null,
  pickupCode: null,
  demo: true,
};

export const DEMO_ORDER_COMPLETED_003: StudentOrder = {
  id: 'demo-order-done-003',
  merchantId: 'demo-merchant-01',
  merchantName: '大众窗口',
  items: [{ dishId: 'demo-dish-tomato-egg', name: '番茄炒蛋饭', quantity: 1, unitPriceFen: 1200 }],
  slotId: 'demo-slot-20261112-lunch',
  slotStart: '2026-11-12T11:30:00+08:00',
  slotEnd: '2026-11-12T12:00:00+08:00',
  diningMode: 'DINE_IN',
  totalFen: 1200,
  status: 'COMPLETED',
  paymentStatus: 'SIMULATED_PAID',
  cancelRequest: { status: 'NONE', reason: null },
  cancellationReason: null,
  version: 4,
  createdAt: '2026-11-12T11:10:00+08:00',
  updatedAt: '2026-11-12T12:05:00+08:00',
  pickedUpAt: '2026-11-12T11:58:00+08:00',
  delay: null,
  pickupCode: 'C 105',
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
    merchantId: DISH_SHOP[dish.dishId] ?? '',
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