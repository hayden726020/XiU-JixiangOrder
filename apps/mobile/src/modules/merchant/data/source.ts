import { ApiError, apiRequest } from '../../../shared/apiClient';
import { getSession } from '../../../shared/session';
import { sampleMenu, sampleOrders, sampleSlots } from './sampleData';
import type {
  Dish,
  MenuDay,
  MerchantOrder,
  MerchantScenario,
  MerchantSource,
  OrderPage,
  Slot,
  SlotDay,
  SourceResult,
} from './types';

interface ApiDish {
  id: string;
  merchantId: string;
  name: string;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
  version?: number;
}

interface ApiSlot {
  id: string;
  date: string;
  startAt: string;
  endAt: string;
  capacity: number;
  booked: number;
  remainingCapacity: number;
  enabled: boolean;
  version?: number;
}

interface ApiMenu {
  date: string;
  slots: ApiSlot[];
  dishes: ApiDish[];
}

interface ApiOrderItem {
  dishId: string;
  name: string;
  quantity: number;
  unitPriceFen: number;
}

interface ApiCancelRequest {
  status: MerchantOrder['cancelRequest']['status'];
  reason: string | null;
  decisionReason?: string | null;
}

interface ApiOrder {
  id: string;
  items: ApiOrderItem[];
  slotId: string;
  slotStart: string;
  slotEnd: string;
  diningMode: MerchantOrder['diningMode'];
  diningModeReason?: string | null;
  totalFen: number;
  status: MerchantOrder['status'];
  paymentStatus: MerchantOrder['paymentStatus'];
  cancelRequest: ApiCancelRequest;
  cancellationReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  pickedUpAt: string | null;
  delay: MerchantOrder['delay'];
  pickupCode: string | null;
}

interface ApiMerchantOrders {
  orders: ApiOrder[];
  page: number;
  pageSize: number;
  total: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function fail<T>(code: string, message: string, retryable = false): SourceResult<T> {
  return { ok: false, error: { code, message, retryable } };
}

function toFailure<T>(error: unknown, fallback = '读取真实数据失败，请稍后重试。'): SourceResult<T> {
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.retryable);
  }
  return fail('UNKNOWN_ERROR', fallback);
}

function normalizePage(page?: number): number {
  return Number.isFinite(page) && page && page > 0 ? Math.trunc(page) : 1;
}

function normalizePageSize(pageSize?: number): number {
  if (!Number.isFinite(pageSize) || !pageSize || pageSize <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.trunc(pageSize));
}

function apiVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapDish(dish: ApiDish): Dish {
  return {
    dishId: dish.id,
    name: dish.name,
    unitPriceFen: dish.priceFen,
    availableQuantity: dish.availableQuantity,
    onSale: dish.onSale,
    version: apiVersion(dish.version),
  };
}

function mapSlot(slot: ApiSlot): Slot {
  return {
    slotId: slot.id,
    slotStart: slot.startAt,
    slotEnd: slot.endAt,
    capacity: slot.capacity,
    occupied: slot.booked,
    remaining: slot.remainingCapacity,
    enabled: slot.enabled,
    full: slot.remainingCapacity <= 0,
    version: apiVersion(slot.version),
  };
}

function mapMenu(payload: ApiMenu, merchantId: string): SourceResult<MenuDay> {
  if (!Array.isArray(payload.dishes) || !Array.isArray(payload.slots) || typeof payload.date !== 'string') {
    return fail('INVALID_RESPONSE', '菜单响应缺少 date/slots/dishes。');
  }
  const dishes = payload.dishes
    .filter((dish) => dish.merchantId === merchantId)
    .map((dish) => mapDish(dish));
  return { ok: true, data: { date: payload.date, demo: false, dishes } };
}

function mapSlots(payload: ApiMenu): SourceResult<SlotDay> {
  if (!Array.isArray(payload.slots) || typeof payload.date !== 'string') {
    return fail('INVALID_RESPONSE', '菜单响应缺少 date/slots。');
  }
  return { ok: true, data: { date: payload.date, demo: false, slots: payload.slots.map((slot) => mapSlot(slot)) } };
}

function mapOrder(order: ApiOrder): MerchantOrder {
  return {
    id: order.id,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
        dishId: item.dishId,
        name: item.name,
        quantity: item.quantity,
        unitPriceFen: item.unitPriceFen,
      }))
      : [],
    slotId: order.slotId,
    slotStart: order.slotStart,
    slotEnd: order.slotEnd,
    diningMode: order.diningMode,
    diningModeReason: order.diningModeReason ?? null,
    totalFen: order.totalFen,
    status: order.status,
    paymentStatus: order.paymentStatus,
    cancelRequest: {
      status: order.cancelRequest?.status ?? 'NONE',
      reason: order.cancelRequest?.reason ?? null,
      decisionReason: order.cancelRequest?.decisionReason ?? null,
    },
    cancellationReason: order.cancellationReason ?? null,
    version: order.version,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    pickedUpAt: order.pickedUpAt ?? null,
    delay: order.delay
      ? { reason: order.delay.reason, expectedReadyAt: order.delay.expectedReadyAt }
      : null,
    pickupCode: order.pickupCode ?? null,
    demo: false,
  };
}

async function requestMerchantOrderWrite(
  path: string,
  body: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<SourceResult<MerchantOrder>> {
  try {
    const data = await apiRequest<ApiOrder>(path, { method, body });
    if (typeof data.id !== 'string' || !Number.isFinite(data.version)) {
      return fail('INVALID_RESPONSE', '写操作响应缺少订单号或版本。');
    }
    return { ok: true, data: mapOrder(data) };
  } catch (error) {
    return toFailure(error, '写操作未完成，请确认订单状态后重试。');
  }
}

function createRealSource(scenario: MerchantScenario): MerchantSource {
  const inFlightMenus = new Map<string, Promise<SourceResult<ApiMenu>>>();

  function loadMenu(date: string): Promise<SourceResult<ApiMenu>> {
    const running = inFlightMenus.get(date);
    if (running) return running;
    const request = apiRequest<ApiMenu>(`/menu?date=${encodeURIComponent(date)}`)
      .then((data): SourceResult<ApiMenu> => ({ ok: true, data }))
      .catch((error: unknown): SourceResult<ApiMenu> => toFailure<ApiMenu>(error))
      .finally(() => inFlightMenus.delete(date));
    inFlightMenus.set(date, request);
    return request;
  }

  function currentMerchantId(): string | null {
    const session = getSession();
    if (!session || session.user.role !== 'MERCHANT') return null;
    return session.user.merchantId ?? null;
  }

  return {
    mode: 'real',
    scenario,
    getOrders: async (pageInput?: number, pageSizeInput?: number) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不读取订单。');
      }
      const page = normalizePage(pageInput);
      const pageSize = normalizePageSize(pageSizeInput);
      try {
        const data = await apiRequest<ApiMerchantOrders>(
          `/merchant/orders?page=${page}&pageSize=${pageSize}`,
        );
        if (!Array.isArray(data.orders)) {
          return fail('INVALID_RESPONSE', '档口订单响应缺少 orders。');
        }
        const orders = data.orders.map(mapOrder);
        return {
          ok: true,
          data: {
            orders,
            page: Number.isFinite(data.page) && data.page > 0 ? data.page : page,
            pageSize: Number.isFinite(data.pageSize) && data.pageSize > 0
              ? data.pageSize
              : pageSize,
            total: Number.isFinite(data.total) && data.total >= 0
              ? data.total
              : orders.length,
          },
        };
      } catch (error) {
        return toFailure(error);
      }
    },
    getOrder: async (id: string) => {
      try {
        const data = await apiRequest<ApiOrder>(`/orders/${encodeURIComponent(id)}`);
        if (typeof data.id !== 'string') {
          return fail('INVALID_RESPONSE', '订单响应缺少 id。');
        }
        return { ok: true, data: mapOrder(data) };
      } catch (error) {
        return toFailure(error);
      }
    },
    getMenu: async (date: string) => {
      const merchantId = currentMerchantId();
      if (!merchantId) {
        return fail(
          'UNAUTHENTICATED',
          '真实模式需要先登录档口演示账号：请到 #/system-check 登录后重试。',
        );
      }
      const result = await loadMenu(date);
      return result.ok ? mapMenu(result.data, merchantId) : result;
    },
    getSlots: async (date: string) => {
      const result = await loadMenu(date);
      return result.ok ? mapSlots(result.data) : result;
    },
    advanceOrder: async (id, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      return requestMerchantOrderWrite(`/merchant/orders/${encodeURIComponent(id)}/advance`, {
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
        action: input.action,
      });
    },
    verifyOrder: async (id, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      return requestMerchantOrderWrite(`/merchant/orders/${encodeURIComponent(id)}/verify`, {
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
        pickupCode: input.pickupCode,
      });
    },
    decideCancellation: async (id, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      return requestMerchantOrderWrite(`/merchant/orders/${encodeURIComponent(id)}/cancel-decision`, {
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
        decision: input.decision,
        reason: input.reason,
      });
    },
    cancelOrder: async (id, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      return requestMerchantOrderWrite(`/merchant/orders/${encodeURIComponent(id)}/cancel`, {
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      });
    },
    setDelay: async (id, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      return requestMerchantOrderWrite(`/merchant/orders/${encodeURIComponent(id)}/delay`, {
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        expectedReadyAt: input.expectedReadyAt,
      });
    },
    changeDiningMode: async (id, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      return requestMerchantOrderWrite(
        `/merchant/orders/${encodeURIComponent(id)}/dining-mode`,
        {
          requestId: input.requestId,
          expectedVersion: input.expectedVersion,
          diningMode: input.diningMode,
          reason: input.reason,
        },
        'PATCH',
      );
    },
    updateDish: async (_date, dishId, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      if (input.expectedVersion === null || !Number.isFinite(input.expectedVersion)) {
        return fail(
          'MENU_VERSION_MISSING',
          '服务端 GET /menu 未返回菜品 version，暂不能安全保存；已记录给后端补字段。',
        );
      }
      try {
        const data = await apiRequest<ApiDish>(`/merchant/menu/${encodeURIComponent(dishId)}`, {
          method: 'PUT',
          body: {
            requestId: input.requestId,
            expectedVersion: input.expectedVersion,
            priceFen: input.priceFen,
            availableQuantity: input.availableQuantity,
            onSale: input.onSale,
          },
        });
        if (typeof data.id !== 'string') {
          return fail('INVALID_RESPONSE', '菜品保存响应缺少 id。');
        }
        return { ok: true, data: mapDish(data) };
      } catch (error) {
        return toFailure(error, '菜品保存失败，请重新读取菜单后重试。');
      }
    },
    updateSlot: async (_date, slotId, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送写请求。');
      }
      if (input.expectedVersion === null || !Number.isFinite(input.expectedVersion)) {
        return fail(
          'MENU_VERSION_MISSING',
          '服务端 GET /menu 未返回时段 version，暂不能安全保存；已记录给后端补字段。',
        );
      }
      try {
        const data = await apiRequest<ApiSlot>(`/merchant/slots/${encodeURIComponent(slotId)}`, {
          method: 'PUT',
          body: {
            requestId: input.requestId,
            expectedVersion: input.expectedVersion,
            capacity: input.capacity,
            enabled: input.enabled,
          },
        });
        if (typeof data.id !== 'string' || typeof data.startAt !== 'string') {
          return fail('INVALID_RESPONSE', '时段保存响应缺少 id 或 startAt。');
        }
        return { ok: true, data: mapSlot(data) };
      } catch (error) {
        return toFailure(error, '时段保存失败，请重新读取菜单后重试。');
      }
    },
  };
}

export function createMerchantSource(options: {
  mode?: 'sample' | 'real';
  scenario?: MerchantScenario;
} = {}): MerchantSource {
  const mode = options.mode ?? 'sample';
  const scenario = options.scenario ?? 'normal';

  if (mode === 'real') {
    return createRealSource(scenario);
  }

  const orders = sampleOrders(scenario);
  const dishWrites = new Map<string, { priceFen: number; availableQuantity: number; onSale: boolean; version: number }>();
  const slotWrites = new Map<string, { capacity: number; enabled: boolean; version: number }>();

  return {
    mode: 'sample',
    scenario,
    getOrders: async (pageInput?: number, pageSizeInput?: number): Promise<SourceResult<OrderPage>> => {
      const page = normalizePage(pageInput);
      const pageSize = normalizePageSize(pageSizeInput);
      const offset = (page - 1) * pageSize;
      return {
        ok: true,
        data: {
          orders: structuredClone(orders.slice(offset, offset + pageSize)),
          page,
          pageSize,
          total: orders.length,
        },
      };
    },
    getOrder: async (id: string): Promise<SourceResult<MerchantOrder>> => {
      const found = orders.find((order) => order.id === id);
      if (!found) return fail('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。');
      return { ok: true, data: structuredClone(found) };
    },
    getMenu: async (date: string): Promise<SourceResult<MenuDay>> => {
      const menu = sampleMenu(date);
      if (!menu) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      const dishes = menu.dishes.map((dish) => {
        const override = dishWrites.get(`${date}:${dish.dishId}`);
        if (!override) return dish;
        return {
          ...dish,
          unitPriceFen: override.priceFen,
          availableQuantity: override.availableQuantity,
          onSale: override.onSale,
          version: override.version,
        };
      });
      return { ok: true, data: { ...menu, dishes } };
    },
    getSlots: async (date: string): Promise<SourceResult<SlotDay>> => {
      const day = sampleSlots(date);
      if (!day) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      const slots = day.slots.map((slot) => {
        const override = slotWrites.get(slot.slotId);
        return override ? { ...slot, ...override } : slot;
      });
      return { ok: true, data: { ...day, slots } };
    },
    advanceOrder: async (): Promise<SourceResult<MerchantOrder>> => (
      fail('SAMPLE_READONLY', '样例模式不发送真实写请求。')
    ),
    verifyOrder: async (): Promise<SourceResult<MerchantOrder>> => (
      fail('SAMPLE_READONLY', '样例模式不发送真实写请求。')
    ),
    decideCancellation: async (): Promise<SourceResult<MerchantOrder>> => (
      fail('SAMPLE_READONLY', '样例模式不发送真实写请求。')
    ),
    cancelOrder: async (): Promise<SourceResult<MerchantOrder>> => (
      fail('SAMPLE_READONLY', '样例模式不发送真实写请求。')
    ),
    setDelay: async (): Promise<SourceResult<MerchantOrder>> => (
      fail('SAMPLE_READONLY', '样例模式不发送真实写请求。')
    ),
    changeDiningMode: async (): Promise<SourceResult<MerchantOrder>> => (
      fail('SAMPLE_READONLY', '样例模式不发送真实写请求。')
    ),
    updateDish: async (date, dishId, input): Promise<SourceResult<Dish>> => {
      const menu = sampleMenu(date);
      const base = menu?.dishes.find((dish) => dish.dishId === dishId);
      if (!base) return fail('DISH_NOT_FOUND', '菜品不存在或不属于当前样例日期。');
      const key = `${date}:${dishId}`;
      const override = dishWrites.get(key);
      const current: Dish = override
        ? {
          ...base,
          unitPriceFen: override.priceFen,
          availableQuantity: override.availableQuantity,
          onSale: override.onSale,
          version: override.version,
        }
        : base;
      const version = current.version ?? 1;
      if (input.expectedVersion === null || input.expectedVersion !== version) {
        return fail('ORDER_VERSION_CONFLICT', '菜品已在其他操作中更新，请重新读取菜单后再保存。');
      }
      const updated: Dish = {
        ...current,
        unitPriceFen: input.priceFen,
        availableQuantity: input.availableQuantity,
        onSale: input.onSale,
        version: version + 1,
      };
      dishWrites.set(key, {
        priceFen: updated.unitPriceFen,
        availableQuantity: updated.availableQuantity,
        onSale: updated.onSale,
        version: updated.version ?? version + 1,
      });
      return { ok: true, data: updated };
    },
    updateSlot: async (date, slotId, input): Promise<SourceResult<Slot>> => {
      const day = sampleSlots(date);
      const base = day?.slots.find((slot) => slot.slotId === slotId);
      if (!base) return fail('SLOT_NOT_FOUND', '时段不存在或不属于当前样例日期。');
      const current = { ...base, ...(slotWrites.get(slotId) ?? {}) };
      const version = current.version ?? 1;
      if (input.expectedVersion === null || input.expectedVersion !== version) {
        return fail('ORDER_VERSION_CONFLICT', '时段已在其他操作中更新，请重新读取菜单后再保存。');
      }
      if (input.capacity < current.occupied) {
        return fail('INVALID_ORDER_STATE', '容量不能低于已占用名额。');
      }
      const remaining = Math.max(input.capacity - current.occupied, 0);
      const updated: Slot = {
        ...current,
        capacity: input.capacity,
        enabled: input.enabled,
        remaining,
        full: remaining <= 0,
        version: version + 1,
      };
      slotWrites.set(slotId, {
        capacity: updated.capacity,
        enabled: updated.enabled,
        version: updated.version ?? version + 1,
      });
      return { ok: true, data: updated };
    },
  };
}