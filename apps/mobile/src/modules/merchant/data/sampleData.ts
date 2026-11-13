import type { Dish, MenuDay, MerchantOrder, MerchantScenario, Slot, SlotDay } from './types';

export const SAMPLE_DATES = ['2026-11-13', '2026-11-14'] as const;

export const DEMO_SCENARIOS: ReadonlyArray<{ value: MerchantScenario; label: string }> = [
  { value: 'normal', label: '正常（5 笔）' },
  { value: 'empty', label: '无订单' },
  { value: 'pending-cancel', label: '待处理取消申请' },
];

const DISHES: Record<string, Dish[]> = {
  '2026-11-13': [
    { dishId: 'demo-dish-01', name: '演示鸡肉饭', unitPriceFen: 1800, availableQuantity: 40, onSale: true },
    { dishId: 'demo-dish-02', name: '演示番茄炒蛋', unitPriceFen: 900, availableQuantity: 35, onSale: true },
    { dishId: 'demo-dish-03', name: '演示青椒肉丝', unitPriceFen: 1500, availableQuantity: 0, onSale: false },
    { dishId: 'demo-dish-04', name: '演示紫菜蛋花汤', unitPriceFen: 500, availableQuantity: 50, onSale: true },
  ],
  '2026-11-14': [
    { dishId: 'demo-dish-01', name: '演示鸡肉饭', unitPriceFen: 1800, availableQuantity: 35, onSale: true },
    { dishId: 'demo-dish-02', name: '演示番茄炒蛋', unitPriceFen: 900, availableQuantity: 30, onSale: true },
    { dishId: 'demo-dish-03', name: '演示青椒肉丝', unitPriceFen: 1500, availableQuantity: 20, onSale: true },
    { dishId: 'demo-dish-04', name: '演示紫菜蛋花汤', unitPriceFen: 500, availableQuantity: 45, onSale: true },
  ],
};

const SLOT_DEFS = [
  { key: 'lunch', start: '11:30', end: '12:00', capacity: 30, occupied: 12 },
  { key: 'late', start: '12:00', end: '12:30', capacity: 30, occupied: 18 },
  { key: 'tail', start: '12:30', end: '13:00', capacity: 20, occupied: 20 },
];

const NORMAL_ORDERS: MerchantOrder[] = [
  {
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
  },
  {
    id: 'demo-order-002',
    items: [
      { dishId: 'demo-dish-02', name: '演示番茄炒蛋', quantity: 2, unitPriceFen: 900 },
      { dishId: 'demo-dish-03', name: '演示青椒肉丝', quantity: 1, unitPriceFen: 1500 },
    ],
    slotId: 'demo-slot-20261113-late',
    slotStart: '2026-11-13T12:00:00+08:00',
    slotEnd: '2026-11-13T12:30:00+08:00',
    diningMode: 'TAKEAWAY',
    totalFen: 3300,
    status: 'ACCEPTED',
    paymentStatus: 'SIMULATED_PAID',
    cancelRequest: { status: 'NONE', reason: null },
    cancellationReason: null,
    version: 2,
    createdAt: '2026-11-13T11:50:00+08:00',
    updatedAt: '2026-11-13T12:02:00+08:00',
    pickedUpAt: null,
    delay: null,
    pickupCode: null,
    demo: true,
  },
  {
    id: 'demo-order-003',
    items: [
      { dishId: 'demo-dish-01', name: '演示鸡肉饭', quantity: 1, unitPriceFen: 1800 },
      { dishId: 'demo-dish-04', name: '演示紫菜蛋花汤', quantity: 1, unitPriceFen: 500 },
    ],
    slotId: 'demo-slot-20261113-lunch',
    slotStart: '2026-11-13T11:30:00+08:00',
    slotEnd: '2026-11-13T12:00:00+08:00',
    diningMode: 'DINE_IN',
    totalFen: 2300,
    status: 'READY',
    paymentStatus: 'SIMULATED_PAID',
    cancelRequest: { status: 'PENDING', reason: '演示申请取消：临时有事' },
    cancellationReason: null,
    version: 4,
    createdAt: '2026-11-13T11:05:00+08:00',
    updatedAt: '2026-11-13T11:25:00+08:00',
    pickedUpAt: null,
    delay: null,
    pickupCode: 'DEMO-572913',
    demo: true,
  },
  {
    id: 'demo-order-004',
    items: [{ dishId: 'demo-dish-02', name: '演示番茄炒蛋', quantity: 2, unitPriceFen: 900 }],
    slotId: 'demo-slot-20261113-lunch',
    slotStart: '2026-11-13T11:30:00+08:00',
    slotEnd: '2026-11-13T12:00:00+08:00',
    diningMode: 'TAKEAWAY',
    totalFen: 1800,
    status: 'COMPLETED',
    paymentStatus: 'SIMULATED_PAID',
    cancelRequest: { status: 'NONE', reason: null },
    cancellationReason: null,
    version: 5,
    createdAt: '2026-11-13T11:20:00+08:00',
    updatedAt: '2026-11-13T11:42:00+08:00',
    pickedUpAt: '2026-11-13T11:42:00+08:00',
    delay: null,
    pickupCode: null,
    demo: true,
  },
  {
    id: 'demo-order-005',
    items: [{ dishId: 'demo-dish-03', name: '演示青椒肉丝', quantity: 1, unitPriceFen: 1500 }],
    slotId: 'demo-slot-20261113-tail',
    slotStart: '2026-11-13T12:30:00+08:00',
    slotEnd: '2026-11-13T13:00:00+08:00',
    diningMode: 'TAKEAWAY',
    totalFen: 1500,
    status: 'CANCELLED',
    paymentStatus: 'SIMULATED_REFUNDED',
    cancelRequest: { status: 'NONE', reason: null },
    cancellationReason: '演示缺货：食材不足',
    version: 2,
    createdAt: '2026-11-13T12:35:00+08:00',
    updatedAt: '2026-11-13T12:40:00+08:00',
    pickedUpAt: null,
    delay: null,
    pickupCode: null,
    demo: true,
  },
];

export function sampleOrders(scenario: MerchantScenario): MerchantOrder[] {
  if (scenario === 'empty') return [];
  if (scenario === 'pending-cancel') {
    return structuredClone(NORMAL_ORDERS.filter((order) => order.id === 'demo-order-003'));
  }
  return structuredClone(NORMAL_ORDERS);
}

export function sampleMenu(date: string): MenuDay | null {
  const dishes = DISHES[date];
  if (!dishes) return null;
  return { date, demo: true, dishes: structuredClone(dishes) };
}

export function sampleSlots(date: string): SlotDay | null {
  if (!DISHES[date]) return null;
  const compact = date.replaceAll('-', '');
  const slots: Slot[] = SLOT_DEFS.map((slot) => ({
    slotId: `demo-slot-${compact}-${slot.key}`,
    slotStart: `${date}T${slot.start}:00+08:00`,
    slotEnd: `${date}T${slot.end}:00+08:00`,
    capacity: slot.capacity,
    occupied: slot.occupied,
    remaining: Math.max(slot.capacity - slot.occupied, 0),
    enabled: true,
    full: slot.occupied >= slot.capacity,
  }));
  return { date, demo: true, slots };
}