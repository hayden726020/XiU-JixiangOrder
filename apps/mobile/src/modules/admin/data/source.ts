import { ApiError, apiRequest } from '../../../shared';
import type { Order, OrderStatus } from '../types';
import { sampleOrders } from './sample';

export type AdminSourceMode = 'sample' | 'live';

export interface AdminOrderQuery {
  status: OrderStatus | 'ALL';
  page: number;
  pageSize: number;
}

export interface AdminOrderPage {
  orders: Order[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminSource {
  mode: AdminSourceMode;
  listOrders(query: AdminOrderQuery): Promise<AdminOrderPage>;
  getOrder(id: string): Promise<Order | null>;
}

const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(): ApiError {
  return new ApiError({
    code: 'INVALID_RESPONSE',
    message: '订单响应格式不正确，未显示为有效订单。',
    status: 0,
    retryable: false,
  });
}

function parseOrder(value: unknown): Order {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !Array.isArray(value.items) ||
    typeof value.totalFen !== 'number' ||
    typeof value.version !== 'number' ||
    !ORDER_STATUSES.includes(value.status as OrderStatus)
  ) {
    throw invalidResponse();
  }
  return value as unknown as Order;
}

function parsePage(value: unknown): AdminOrderPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.orders) ||
    typeof value.page !== 'number' ||
    typeof value.pageSize !== 'number' ||
    typeof value.total !== 'number'
  ) {
    throw invalidResponse();
  }
  return {
    orders: value.orders.map(parseOrder),
    page: value.page,
    pageSize: value.pageSize,
    total: value.total,
  };
}

function samplePage(query: AdminOrderQuery): AdminOrderPage {
  const filtered =
    query.status === 'ALL'
      ? sampleOrders
      : sampleOrders.filter((order) => order.status === query.status);
  const start = (query.page - 1) * query.pageSize;
  return {
    orders: filtered.slice(start, start + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: filtered.length,
  };
}

export function createAdminSource(options: { mode: AdminSourceMode }): AdminSource {
  if (options.mode === 'live') {
    return {
      mode: 'live',
      listOrders: async (query) => {
        const params = new URLSearchParams({
          page: String(query.page),
          pageSize: String(query.pageSize),
        });
        if (query.status !== 'ALL') {
          params.set('status', query.status);
        }
        const data = await apiRequest<unknown>(`/admin/orders?${params.toString()}`);
        return parsePage(data);
      },
      getOrder: async (id) => {
        try {
          const data = await apiRequest<unknown>(`/orders/${encodeURIComponent(id)}`);
          return parseOrder(data);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
    };
  }

  return {
    mode: 'sample',
    listOrders: async (query) => samplePage(query),
    getOrder: async (id) => sampleOrders.find((order) => order.id === id) ?? null,
  };
}