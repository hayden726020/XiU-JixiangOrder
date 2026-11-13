import { ApiError, apiRequest } from '../../../shared/apiClient';
import { getSession } from '../../../shared/session';
import { sampleMenu, sampleOrders, sampleSlots } from './sampleData';
import type { MenuDay, MerchantOrder, MerchantScenario, MerchantSource, SlotDay, SourceResult } from './types';

interface ApiDish {
  id: string;
  merchantId: string;
  name: string;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
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
}

interface ApiMenu {
  date: string;
  slots: ApiSlot[];
  dishes: ApiDish[];
}

interface ApiMerchantOrders {
  orders: MerchantOrder[];
  page: number;
  pageSize: number;
  total: number;
}

function fail<T>(code: string, message: string, retryable = false): SourceResult<T> {
  return { ok: false, error: { code, message, retryable } };
}

function toFailure<T>(error: unknown): SourceResult<T> {
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.retryable);
  }
  return fail('UNKNOWN_ERROR', '读取真实数据失败，请稍后重试。');
}

function mapMenu(payload: ApiMenu, merchantId: string): SourceResult<MenuDay> {
  if (!Array.isArray(payload.dishes) || !Array.isArray(payload.slots) || typeof payload.date !== 'string') {
    return fail('INVALID_RESPONSE', '菜单响应缺少 date/slots/dishes。');
  }
  const dishes = payload.dishes
    .filter((dish) => dish.merchantId === merchantId)
    .map((dish) => ({
      dishId: dish.id,
      name: dish.name,
      unitPriceFen: dish.priceFen,
      availableQuantity: dish.availableQuantity,
      onSale: dish.onSale,
    }));
  return { ok: true, data: { date: payload.date, demo: false, dishes } };
}

function mapSlots(payload: ApiMenu): SourceResult<SlotDay> {
  if (!Array.isArray(payload.slots) || typeof payload.date !== 'string') {
    return fail('INVALID_RESPONSE', '菜单响应缺少 date/slots。');
  }
  const slots = payload.slots.map((slot) => ({
    slotId: slot.id,
    slotStart: slot.startAt,
    slotEnd: slot.endAt,
    capacity: slot.capacity,
    occupied: slot.booked,
    remaining: slot.remainingCapacity,
    enabled: slot.enabled,
    full: slot.remainingCapacity <= 0,
  }));
  return { ok: true, data: { date: payload.date, demo: false, slots } };
}

function mapOrder(order: MerchantOrder): MerchantOrder {
  return { ...order, demo: false };
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
    getOrders: async () => {
      try {
        const data = await apiRequest<ApiMerchantOrders>('/merchant/orders?page=1&pageSize=100');
        if (!Array.isArray(data.orders)) {
          return fail('INVALID_RESPONSE', '档口订单响应缺少 orders。');
        }
        return { ok: true, data: data.orders.map(mapOrder) };
      } catch (error) {
        return toFailure(error);
      }
    },
    getOrder: async (id: string) => {
      try {
        const data = await apiRequest<MerchantOrder>(`/orders/${encodeURIComponent(id)}`);
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

  return {
    mode: 'sample',
    scenario,
    getOrders: async (): Promise<SourceResult<MerchantOrder[]>> => ({ ok: true, data: structuredClone(orders) }),
    getOrder: async (id: string): Promise<SourceResult<MerchantOrder>> => {
      const found = orders.find((order) => order.id === id);
      if (!found) return fail('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。');
      return { ok: true, data: structuredClone(found) };
    },
    getMenu: async (date: string): Promise<SourceResult<MenuDay>> => {
      const menu = sampleMenu(date);
      if (!menu) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: menu };
    },
    getSlots: async (date: string): Promise<SourceResult<SlotDay>> => {
      const slots = sampleSlots(date);
      if (!slots) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: slots };
    },
  };
}