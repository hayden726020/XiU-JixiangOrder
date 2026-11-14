import { apiRequest, type ApiRequestOptions } from '../../../shared/apiClient';
import type {
  CancelOrderInput,
  CreateOrderInput,
  CrowdReference,
  DemoScenario,
  MenuResponse,
  QueryOrderResultInput,
  ShopSummary,
  StudentOrder,
  StudentSource,
} from '../types';
import { apiError, isApiError } from '../types';
import {
  mapCrowdResponse,
  mapMenuResponse,
  mapOrderResponse,
  mapOrdersResponse,
  mapShopListResponse,
} from './fieldMapping';

export type RealRequest = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

export interface RealSourceOptions {
  request?: RealRequest;
  now?: () => Date;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 契约未定义 /menu 的 merchantId 过滤参数，确认前不加查询参数，客户端过滤。 */
export const SHOP_FILTER_QUERY_ENABLED = false;

const SHOP_LIST_UNAVAILABLE_CODES = new Set([404, 405, 501]);

function defaultRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>(path, options);
}

function orderBody(input: CreateOrderInput): Record<string, unknown> {
  return {
    requestId: input.requestId,
    items: input.items.map((item) => ({ dishId: item.dishId, quantity: item.quantity })),
    slotId: input.slotId,
    diningMode: input.diningMode,
  };
}

function isDiningMode(value: unknown): value is CreateOrderInput['diningMode'] {
  return value === 'DINE_IN' || value === 'TAKEAWAY';
}

export function createRealStudentSource(options: RealSourceOptions = {}): StudentSource {
  const request = options.request ?? defaultRequest;

  async function postOrder(input: CreateOrderInput): Promise<StudentOrder> {
    const payload = await request<unknown>('/orders', {
      method: 'POST',
      body: orderBody(input),
    });
    return mapOrderResponse(payload, { demo: false, where: '订单响应' });
  }

  return {
    mode: 'real',

    async listShops(): Promise<ShopSummary[]> {
      try {
        const payload = await request<unknown>('/merchants');
        return mapShopListResponse(payload, { demo: false });
      } catch (error) {
        if (isApiError(error) && SHOP_LIST_UNAVAILABLE_CODES.has(error.status)) {
          throw apiError('SHOP_LIST_UNAVAILABLE', '服务端未提供店铺列表。', true);
        }
        throw error;
      }
    },

    async getMenu(date: string): Promise<MenuResponse> {
      if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
        throw apiError('VALIDATION_ERROR', '日期格式必须是 YYYY-MM-DD。', false);
      }
      const payload = await request<unknown>(`/menu?date=${encodeURIComponent(date)}`);
      return mapMenuResponse(payload);
    },

    async getCrowd(slotId: string): Promise<CrowdReference> {
      if (typeof slotId !== 'string' || slotId.trim() === '') {
        throw apiError('VALIDATION_ERROR', '时段编号不能为空。', false);
      }
      const payload = await request<unknown>(`/crowd?slotId=${encodeURIComponent(slotId)}`);
      return mapCrowdResponse(payload);
    },

    async createOrder(input: CreateOrderInput): Promise<StudentOrder> {
      return postOrder(input);
    },

    async queryOrderResult(input: QueryOrderResultInput | string): Promise<StudentOrder> {
      if (typeof input === 'string') {
        throw apiError('VALIDATION_ERROR', '恢复查询需要完整的下单内容。', false);
      }
      if (
        typeof input.requestId !== 'string' ||
        input.requestId.trim() === '' ||
        !Array.isArray(input.items) ||
        input.items.length === 0 ||
        typeof input.slotId !== 'string' ||
        !isDiningMode(input.diningMode)
      ) {
        throw apiError('VALIDATION_ERROR', '恢复查询需要完整的下单内容。', false);
      }
      // 契约没有按 requestId 查询的接口：同一 requestId + 同内容重发 POST /orders 幂等返回首次结果。
      return postOrder({
        requestId: input.requestId,
        items: input.items,
        slotId: input.slotId,
        diningMode: input.diningMode,
      });
    },

    async getOrder(id: string): Promise<StudentOrder> {
      const payload = await request<unknown>(`/orders/${encodeURIComponent(id)}`);
      return mapOrderResponse(payload, { demo: false, where: '订单响应' });
    },

    async listOrders(): Promise<StudentOrder[]> {
      const payload = await request<unknown>('/orders');
      return mapOrdersResponse(payload, { where: '订单列表' });
    },

    async cancelOrder(input: CancelOrderInput): Promise<StudentOrder> {
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      const body: Record<string, unknown> = {
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
      };
      if (reason !== '') {
        body.reason = reason;
      }
      const payload = await request<unknown>(
        `/orders/${encodeURIComponent(input.orderId)}/cancel`,
        { method: 'POST', body },
      );
      return mapOrderResponse(payload, { demo: false, where: '取消订单响应' });
    },

    setScenario(): DemoScenario {
      throw apiError('SAMPLE_MODE_ONLY', '真实模式不提供样例场景。', false);
    },

    getScenario(): DemoScenario {
      return 'normal';
    },
  };
}