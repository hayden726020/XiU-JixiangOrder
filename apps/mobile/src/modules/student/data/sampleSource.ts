import type {
  CreateOrderInput,
  CrowdReference,
  DemoScenario,
  DiningMode,
  MenuResponse,
  OrderItem,
  QueryOrderResultInput,
  ShopSummary,
  StudentMode,
  StudentOrder,
  StudentSource,
} from '../types';
import { apiError, apiErrorWithDishNames } from '../types';
import { createRealStudentSource, type RealRequest } from './realSource';
import { resolveStudentMode } from './mode';
import { sumFen } from '../utils/money';
import { DISH_SHORTAGE_SUBMIT, SLOT_UNAVAILABLE_MESSAGE } from '../utils/submitTexts';
import {
  CROWD_REFERENCE,
  DATES,
  DEMO_ORDER_001,
  DEMO_SHOPS,
  DISH_SHOP,
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
  mode?: StudentMode;
  scenario?: DemoScenario;
  now?: () => Date;
  request?: RealRequest;
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

function dishNamesOf(items: DraftItemInput[]): string[] {
  const names = items
    .map((item) => findDish(item.dishId)?.name)
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '');
  return [...new Set(names)];
}

export function createStudentSource({
  mode = 'sample',
  scenario = 'normal',
  now,
  request,
}: StudentSourceOptions = {}): StudentSource {
  if (mode === 'real') {
    return createRealStudentSource({ request, now });
  }
  const clock = now ?? (() => new Date('2026-11-13T11:45:00+08:00'));
  if (!SCENARIOS.has(scenario)) {
    throw apiError('VALIDATION_ERROR', '未知的样例场景切换值。', false);
  }

  let currentScenario: DemoScenario = scenario;
  let localSeq = 2;
  const createdByRequest = new Map<string, { fingerprint: string; order: StudentOrder }>();
  const pendingByRequest = new Map<string, StudentOrder>();
  const ordersById = new Map<string, StudentOrder>([[DEMO_ORDER_001.id, clone(DEMO_ORDER_001)]]);

  function assertInput(input: CreateOrderInput): void {
    if (!input || typeof input !== 'object') {
      throw apiError('VALIDATION_ERROR', '下单内容不完整。', false);
    }
    if (typeof input.requestId !== 'string' || input.requestId.trim() === '') {
      throw apiError('VALIDATION_ERROR', '缺少下单请求号。', false);
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw apiError('VALIDATION_ERROR', '请至少选择一道菜。', false);
    }
    for (const item of input.items) {
      if (!DINING_MODES.has(input.diningMode)) {
        throw apiError('VALIDATION_ERROR', '请选择堂食或外带。', false);
      }
      if (!findDish(item.dishId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw apiError('VALIDATION_ERROR', '菜品或份数不合法。', false);
      }
    }
    if (!findSlot(input.slotId)) {
      throw apiError('VALIDATION_ERROR', '时段不存在。', false);
    }
  }

  function assertBusiness(input: CreateOrderInput): void {
    const slot = findSlot(input.slotId);
    if (!slot) {
      throw apiError('VALIDATION_ERROR', '时段不存在。', false);
    }
    const shortage: string[] = [];
    for (const item of input.items) {
      const dish = findDish(item.dishId);
      if (!dish) {
        throw apiError('VALIDATION_ERROR', '菜品或份数不合法。', false);
      }
      const available = dish.availability[slot.date] ?? 0;
      const onSale = dish.onSale[slot.date] === true;
      if (!onSale || item.quantity > available) {
        shortage.push(dish.name);
      }
    }
    if (shortage.length > 0) {
      throw apiErrorWithDishNames('OUT_OF_STOCK', DISH_SHORTAGE_SUBMIT, [...new Set(shortage)]);
    }
  }

  function buildOrder(input: CreateOrderInput): StudentOrder {
    const slot = findSlot(input.slotId);
    if (!slot) {
      throw apiError('VALIDATION_ERROR', '时段不存在。', false);
    }
    const items: OrderItem[] = input.items.map((item) => {
      const dish = findDish(item.dishId);
      if (!dish) {
        throw apiError('VALIDATION_ERROR', '菜品或份数不合法。', false);
      }
      return { dishId: dish.dishId, name: dish.name, quantity: item.quantity, unitPriceFen: dish.unitPriceFen };
    });
    const merchantIds = new Set(
      input.items.map((item) => DISH_SHOP[item.dishId] ?? '').filter((id) => id !== ''),
    );
    if (merchantIds.size !== 1) {
      throw apiError('VALIDATION_ERROR', '该订单包含不同店铺的菜品，请只保留当前店铺菜品。', false);
    }
    const merchantId = [...merchantIds][0];
    const merchantName = DEMO_SHOPS.find((shop) => shop.merchantId === merchantId)?.name ?? null;
    const totalFen = sumFen(items);
    const isSameOrder =
      JSON.stringify(normalizeItems(input.items)) === SAME_ORDER_ITEMS &&
      input.slotId === SAME_ORDER_SLOT &&
      input.diningMode === 'DINE_IN';

    if (isSameOrder) {
      return clone(DEMO_ORDER_001);
    }

    const timestamp = isoShanghai(clock());
    const id = `demo-order-local-${pad(localSeq)}`;
    localSeq += 1;
    return {
      id,
      merchantId,
      merchantName,
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

    async listShops(): Promise<ShopSummary[]> {
      return clone(DEMO_SHOPS);
    },

    async getMenu(date: string): Promise<MenuResponse> {
      if (!DATES.includes(date)) {
        throw apiError('VALIDATION_ERROR', '日期只能是今天或明天。', false);
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
        throw apiError('ORDER_NOT_FOUND', '该时段不存在。', false);
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
          throw apiError('REQUEST_CONFLICT', '该请求号对应了不同内容，请重新确认后下单。', false);
        }
        return clone(prior.order);
      }

      if (currentScenario === 'slot-full') {
        throw apiError('SLOT_FULL', SLOT_UNAVAILABLE_MESSAGE, false);
      }
      if (currentScenario === 'out-of-stock') {
        throw apiErrorWithDishNames('OUT_OF_STOCK', DISH_SHORTAGE_SUBMIT, dishNamesOf(input.items));
      }

      assertBusiness(input);
      const order = buildOrder(input);
      remember(input.requestId, order);

      if (currentScenario === 'timeout') {
        throw apiError('TIMEOUT', '网络超时，订单可能已创建。请先查询结果，不要重复下单。', true);
      }
      return clone(order);
    },

    async queryOrderResult(input: QueryOrderResultInput | string): Promise<StudentOrder> {
      const requestId = typeof input === 'string' ? input : input.requestId;
      if (typeof requestId !== 'string' || requestId.trim() === '') {
        throw apiError('VALIDATION_ERROR', '缺少下单请求号。', false);
      }
      const order = pendingByRequest.get(requestId) ?? createdByRequest.get(requestId)?.order;
      if (!order) {
        throw apiError('ORDER_NOT_FOUND', '未找到该请求对应的订单。', false);
      }
      return clone(order);
    },

    async getOrder(id: string): Promise<StudentOrder> {
      const order = ordersById.get(id);
      if (!order) {
        throw apiError('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。', false);
      }
      return clone(order);
    },

    async listOrders(): Promise<StudentOrder[]> {
      return [...ordersById.values()]
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    setScenario(next: DemoScenario): DemoScenario {
      if (!SCENARIOS.has(next)) {
        throw apiError('VALIDATION_ERROR', '未知的样例场景切换值。', false);
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
  return createStudentSource({ mode: resolveStudentMode() });
}