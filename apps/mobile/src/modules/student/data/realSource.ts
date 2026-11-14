import { apiRequest, type ApiRequestOptions } from '../../../shared/apiClient';
import type {
  CreateOrderInput,
  CrowdReference,
  DemoScenario,
  MenuResponse,
  QueryOrderResultInput,
  StudentOrder,
  StudentSource,
} from '../types';
import { apiError } from '../types';
import { mapCrowdResponse, mapMenuResponse, mapOrderResponse } from './fieldMapping';

export type RealRequest = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

export interface RealSourceOptions {
  request?: RealRequest;
  now?: () => Date;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

    setScenario(): DemoScenario {
      throw apiError('SAMPLE_MODE_ONLY', '真实模式不提供样例场景。', false);
    },

    getScenario(): DemoScenario {
      return 'normal';
    },
  };
}