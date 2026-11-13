import type {
  CreateOrderInput,
  CrowdReference,
  DemoScenario,
  DiningMode,
  MenuResponse,
  OrderItem,
  StudentOrder,
  StudentSource,
} from '../types';
import { ApiError } from '../types';
import { sumFen } from '../utils/money';
import {
  CROWD_REFERENCE,
  DATES,
  DEMO_ORDER_001,
  DISHES,
  SLOTS,
  clone,
  findDish,
  findSlot,
  toDishDto,
  toSlotDto,
} from './sampleData';
import type { DraftItemInput } from '../types';

const DINING_MODES = new Set<DiningMode>(['DINE_IN', 'TAKEAWAY']);
const SCENARIOS = new Set<DemoScenario>(['normal', 'slot-full', 'out-of-stock', 'timeout']);
const SAME_ORDER_SLOT = 'demo-slot-20261113-lunch';
const SAME_ORDER_ITEMS = JSON.stringify([{ dishId: 'demo-dish-01', quantity: 1 }]);

export interface StudentSourceOptions {
  mode?: 'sample' | 'real';
  scenario?: DemoScenario;
  now?: () => Date;
}

function normalizeItems(items: DraftItemInput[]): DraftItemInput[] {
  return items
    .slice()
    .sort((a, b) => String(a.dishId).localeCompare(String(b.dishId)))
    .map((item) => ({ dishId: item.dishId, quantity: item.quantity }));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isoShanghai(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = pad(shifted.getUTCMonth() + 1);
  const d = pad(shifted.getUTCDate());
  const hh = pad(shifted.getUTCHours());
  const mm = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`;
}

export function createStudentSource({
  mode = 'sample',
  scenario = 'normal',
  now = () => new Date('2026-11-13T11:45:00+08:00'),
}: StudentSourceOptions = {}): StudentSource {
  if (mode !== 'sample') {
    throw new ApiError('REAL_MODE_NOT_READY', '真实模式尚未接入，不允许静默降级为样例数据。', false);
  }
  if (!SCENARIOS.has(scenario)) {
    throw new ApiError('VALIDATION_ERROR', '未知的样例场景切换值。', false);
  }

  let currentScenario: DemoScenario = scenario;
  let localSeq = 2;
  const createdByRequest = new Map<string, { fingerprint: string; order: StudentOrder }>();
  const pendingByRequest = new Map<string, StudentOrder>();
  const ordersById = new Map<string, StudentOrder>([[DEMO_ORDER_001.id, clone(DEMO_ORDER_001)]]);

  function assertInput(input: CreateOrderInput): void {
    if (!input || typeof input !== 'object') {
      throw new ApiError('VALIDATION_ERROR', '下单内容不完整。', false);
    }
    if (typeof input.requestId !== 'string' || input.requestId.trim() === '') {
      throw new ApiError('VALIDATION_ERROR', '缺少下单请求号。', false);
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ApiError('VALIDATION_ERROR', '请至少选择一道菜。', false);
    }
    for (const item of input.items) {
      if (!DINING_MODES.has(input.diningMode)) {
        throw new ApiError('VALIDATION_ERROR', '请选择堂食或外带。', false);
      }
      if (!findDish(item.dishId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ApiError('VALIDATION_ERROR', '菜品或份数不合法。', false);
      }
    }
    if (!findSlot(input.slotId)) {
      throw new ApiError('VALIDATION_ERROR', '时段不存在。', false);
    }
  }

  function assertBusiness(input: CreateOrderInput): void {
    const slot = findSlot(input.slotId);
    if (!slot) {
      throw new ApiError('VALIDATION_ERROR', '时段不存在。', false);
    }
    if (slot.capacity - slot.occupied <= 0) {
      throw new ApiError('SLOT_FULL', '该时段名额已满，请选择其他时段。', false);
    }
    for (const item of input.items) {
      const dish = findDish(item.dishId);
      if (!dish) {
        throw new ApiError('VALIDATION_ERROR', '菜品或份数不合法。', false);
      }
      const available = dish.availability[slot.date] ?? 0;
      const onSale = dish.onSale[slot.date] === true;
      if (!onSale || item.quantity > available) {
        throw new ApiError('OUT_OF_STOCK', '所选菜品数量不足，请调整数量。', false);
      }
    }
  }

  function buildOrder(input: CreateOrderInput): StudentOrder {
    const slot = findSlot(input.slotId);
    if (!slot) {
      throw new ApiError('VALIDATION_ERROR', '时段不存在。', false);
    }
    const items: OrderItem[] = input.items.map((item) => {
      const dish = findDish(item.dishId);
      if (!dish) {
        throw new ApiError('VALIDATION_ERROR', '菜品或份数不合法。', false);
      }
      return { dishId: dish.dishId, name: dish.name, quantity: item.quantity, unitPriceFen: dish.unitPriceFen };
    });
    const totalFen = sumFen(items);
    const isSameOrder =
      JSON.stringify(normalizeItems(input.items)) === SAME_ORDER_ITEMS &&
      input.slotId === SAME_ORDER_SLOT &&
      input.diningMode === 'DINE_IN';

    if (isSameOrder) {
      return clone(DEMO_ORDER_001);
    }

    const timestamp = isoShanghai(now());
    const id = `demo-order-local-${pad(localSeq)}`;
    localSeq += 1;
    return {
      id,
      items,
      slotId: slot.slotId,
      slotStart: `${slot.date}T${slot.start}:00+08:00`,
      slotEnd: `${slot.date}T${slot.end}:00+08:00`,
      diningMode: input.diningMode,
      totalFen,
      status: 'NEW',
      paymentStatus: 'SIMULATED_PAID',
      cancelRequest: { status: 'NONE', reason: null },
      cancellationReason: null,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      pickedUpAt: null,
      delay: null,
      pickupCode: null,
      demo: true,
      local: true,
    };
  }

  function remember(requestId: string, order: StudentOrder): void {
    const fingerprint = JSON.stringify({
      items: normalizeItems([...order.items].map(({ dishId, quantity }) => ({ dishId, quantity }))),
      slotId: order.slotId,
      diningMode: order.diningMode,
    });
    createdByRequest.set(requestId, { fingerprint, order });
    pendingByRequest.set(requestId, order);
    ordersById.set(order.id, order);
  }

  return {
    mode: 'sample',

    async getMenu(date: string): Promise<MenuResponse> {
      if (!DATES.includes(date)) {
        throw new ApiError('VALIDATION_ERROR', '日期只能是今天或明天。', false);
      }
      return clone({
        date,
        demo: true,
        dishes: DISHES.map((dish) => toDishDto(dish, date)),
        slots: SLOTS.filter((slot) => slot.date === date).map(toSlotDto),
      });
    },

    async getCrowd(slotId: string): Promise<CrowdReference> {
      const reference = CROWD_REFERENCE[slotId];
      if (!reference) {
        throw new ApiError('ORDER_NOT_FOUND', '该时段不存在。', false);
      }
      return clone(reference);
    },

    async createOrder(input: CreateOrderInput): Promise<StudentOrder> {
      assertInput(input);
      const fingerprint = JSON.stringify({
        items: normalizeItems(input.items),
        slotId: input.slotId,
        diningMode: input.diningMode,
      });

      const prior = createdByRequest.get(input.requestId);
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          throw new ApiError('REQUEST_CONFLICT', '该请求号对应了不同内容，请重新确认后下单。', false);
        }
        return clone(prior.order);
      }

      if (currentScenario === 'slot-full') {
        throw new ApiError('SLOT_FULL', '该时段名额已满，请选择其他时段。', false);
      }
      if (currentScenario === 'out-of-stock') {
        throw new ApiError('OUT_OF_STOCK', '所选菜品数量不足，请调整数量。', false);
      }

      assertBusiness(input);
      const order = buildOrder(input);
      remember(input.requestId, order);

      if (currentScenario === 'timeout') {
        throw new ApiError('TIMEOUT', '网络超时，订单可能已创建。请先查询结果，不要重复下单。', true);
      }
      return clone(order);
    },

    async queryOrderResult(requestId: string): Promise<StudentOrder> {
      const order = pendingByRequest.get(requestId) ?? createdByRequest.get(requestId)?.order;
      if (!order) {
        throw new ApiError('ORDER_NOT_FOUND', '未找到该请求对应的订单。', false);
      }
      return clone(order);
    },

    async getOrder(id: string): Promise<StudentOrder> {
      const order = ordersById.get(id);
      if (!order) {
        throw new ApiError('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。', false);
      }
      return clone(order);
    },

    setScenario(next: DemoScenario): DemoScenario {
      if (!SCENARIOS.has(next)) {
        throw new ApiError('VALIDATION_ERROR', '未知的样例场景切换值。', false);
      }
      currentScenario = next;
      return currentScenario;
    },

    getScenario(): DemoScenario {
      return currentScenario;
    },
  };
}

export function createDefaultStudentSource(): StudentSource {
  return createStudentSource({ mode: 'sample' });
}