import { ApiError, apiRequest } from '../../../shared';
import type {
  AdminMerchantAccount,
  AdminSettings,
  CreateMerchantAccountInput,
  Order,
  OrderStatus,
} from '../types';
import { sampleOrders, sampleSettings } from './sample';

export type AdminSourceMode = 'sample' | 'live';

export type AdminErrorSimulation = 'none' | '401' | '403' | '503';

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

export type AdminSettingsSection = 'dining' | 'crowd';

export interface DiningUpdatePayload {
  canteenId: string;
  name: string;
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  accuracyToleranceMeters: number;
  demo: boolean;
}

export interface CrowdUpdatePayload {
  crowdedAt: number;
  demo: boolean;
}

export interface SettingsUpdateRequestDining {
  section: 'dining';
  requestId: string;
  expectedVersion: number;
  value: DiningUpdatePayload;
}

export interface SettingsUpdateRequestCrowd {
  section: 'crowd';
  requestId: string;
  expectedVersion: number;
  value: CrowdUpdatePayload;
}

export type SettingsUpdateRequest = SettingsUpdateRequestDining | SettingsUpdateRequestCrowd;

export interface SettingsUpdateResult {
  section: AdminSettingsSection;
  version: number;
}

export interface AdminSource {
  mode: AdminSourceMode;
  listOrders(query: AdminOrderQuery): Promise<AdminOrderPage>;
  getOrder(id: string): Promise<Order | null>;
  getSettings(): Promise<AdminSettings>;
  updateSettings(request: SettingsUpdateRequest): Promise<SettingsUpdateResult>;

  listMerchantAccounts(): Promise<AdminMerchantAccount[]>;
  createMerchantAccount(input: CreateMerchantAccountInput): Promise<AdminMerchantAccount>;
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

function invalidSettingsResponse(): ApiError {
  return new ApiError({
    code: 'INVALID_RESPONSE',
    message: '配置响应格式不正确，未显示为有效配置。',
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

function parseSettings(value: unknown): AdminSettings {
  if (!isRecord(value) || !isRecord(value.dining) || !isRecord(value.crowd)) {
    throw invalidSettingsResponse();
  }
  const dining = value.dining;
  const crowd = value.crowd;
  const center = dining.center;
  if (
    typeof dining.canteenId !== 'string' ||
    typeof dining.name !== 'string' ||
    !isRecord(center) ||
    typeof center.latitude !== 'number' ||
    typeof center.longitude !== 'number' ||
    typeof dining.radiusMeters !== 'number' ||
    typeof dining.accuracyToleranceMeters !== 'number' ||
    typeof dining.version !== 'number' ||
    typeof crowd.crowdedAt !== 'number' ||
    typeof crowd.version !== 'number'
  ) {
    throw invalidSettingsResponse();
  }
  return {
    dining: {
      canteenId: dining.canteenId,
      name: dining.name,
      center: { latitude: center.latitude, longitude: center.longitude },
      radiusMeters: dining.radiusMeters,
      accuracyToleranceMeters: dining.accuracyToleranceMeters,
      updatedAt: typeof dining.updatedAt === 'string' ? dining.updatedAt : undefined,
      demo: dining.demo === true,
      version: dining.version,
    },
    crowd: {
      crowdedAt: crowd.crowdedAt,
      demo: crowd.demo === true,
      version: crowd.version,
    },
  };
}

function parseSettingsUpdate(value: unknown, section: AdminSettingsSection): SettingsUpdateResult {
  if (!isRecord(value) || value.section !== section || typeof value.version !== 'number') {
    throw invalidSettingsResponse();
  }
  return { section, version: value.version };
}


function parseMerchantAccount(value: unknown): AdminMerchantAccount {
  if (!isRecord(value)) throw invalidResponse();
  return {
    userId: typeof value.userId === 'string' ? value.userId : '',
    account: typeof value.account === 'string' ? value.account : '',
    password: typeof value.password === 'string' ? value.password : null,
    active: value.active !== false,
    merchantId: typeof value.merchantId === 'string' ? value.merchantId : null,
    merchantName: typeof value.merchantName === 'string' ? value.merchantName : null,
    shopName: typeof value.shopName === 'string' ? value.shopName : null,
    contactName: typeof value.contactName === 'string' ? value.contactName : null,
    contactPhone: typeof value.contactPhone === 'string' ? value.contactPhone : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : null,
  };
}

const SAMPLE_MERCHANT_PROFILE_KEY = 'merchant-sample-profile-v1';

interface SampleMerchantProfileSnapshot {
  merchant?: {
    id?: string;
    name?: string;
    contactName?: string | null;
    contactPhone?: string | null;
  } | null;
  shop?: {
    id?: string;
    name?: string;
  } | null;
}

function readSampleMerchantProfileSnapshot(): SampleMerchantProfileSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SAMPLE_MERCHANT_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? (parsed as SampleMerchantProfileSnapshot) : null;
  } catch {
    return null;
  }
}

function applySampleProfileToOrder(order: Order): Order {
  const snapshot = readSampleMerchantProfileSnapshot();
  if (!snapshot) return order;
  const targetMerchantId = snapshot.merchant?.id ?? 'demo-merchant-01';
  if (order.merchantId !== targetMerchantId && order.merchantId !== 'demo-merchant-01') {
    return order;
  }
  const latestName = snapshot.shop?.name?.trim() || snapshot.merchant?.name?.trim();
  if (!latestName) return order;
  return {
    ...order,
    merchantName: latestName,
  };
}


let sampleMerchantAccountState: AdminMerchantAccount[] = [
  {
    userId: 'demo-user-merchant-01',
    account: 'demo-merchant',
    password: 'demo-pass',
    active: true,
    merchantId: 'demo-merchant-01',
    merchantName: '一食堂·家常档',
    shopName: '一食堂 · 家常档',
    contactName: '王师傅',
    contactPhone: '138****8888',
    createdAt: '2026-11-13T08:00:00+08:00',
  },
];

function samplePage(query: AdminOrderQuery): AdminOrderPage {
  const syncedOrders = sampleOrders.map(applySampleProfileToOrder);
  const filtered =
    query.status === 'ALL'
      ? syncedOrders
      : syncedOrders.filter((order) => order.status === query.status);
  const start = (query.page - 1) * query.pageSize;
  return {
    orders: filtered.slice(start, start + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: filtered.length,
  };
}

function simulatedError(simulation: AdminErrorSimulation): ApiError | null {
  switch (simulation) {
    case '401':
      return new ApiError({
        code: 'UNAUTHENTICATED',
        message: '身份已失效，请重新登录管理员演示身份。',
        status: 401,
        retryable: false,
      });
    case '403':
      return new ApiError({
        code: 'FORBIDDEN',
        message: '当前身份无管理权限。',
        status: 403,
        retryable: false,
      });
    case '503':
      return new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        message: '服务暂不可用，查询未完成；保存结果可能未确定。',
        status: 503,
        retryable: true,
      });
    case 'none':
      return null;
  }
}

function applySimulation(source: AdminSource, simulation: AdminErrorSimulation): AdminSource {
  if (simulation === 'none') {
    return source;
  }
  const fail = (): Promise<never> => Promise.reject(simulatedError(simulation));
  return {
    ...source,
    listOrders: fail,
    getOrder: fail,
    getSettings: fail,
    updateSettings: fail,
  };
}

export function createAdminSource(options: {
  mode: AdminSourceMode;
  simulateError?: AdminErrorSimulation;
}): AdminSource {
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
      getSettings: async () => parseSettings(await apiRequest<unknown>('/admin/settings')),
      updateSettings: async (request) => {
        const data = await apiRequest<unknown>('/admin/settings', {
          method: 'PUT',
          body: {
            requestId: request.requestId,
            section: request.section,
            expectedVersion: request.expectedVersion,
            value: request.value,
          },
        });
        return parseSettingsUpdate(data, request.section);
      },

      listMerchantAccounts: async () => {
        const data = await apiRequest<unknown>('/admin/merchant-accounts');
        if (!isRecord(data) || !Array.isArray(data.accounts)) throw invalidResponse();
        return data.accounts.map(parseMerchantAccount);
      },
      createMerchantAccount: async (input) => {
        const data = await apiRequest<unknown>('/admin/merchant-accounts', {
          method: 'POST',
          body: {
            requestId: input.requestId,
            account: input.account,
            password: input.password,
            merchantName: input.merchantName,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
          },
        });
        return parseMerchantAccount(data);
      },
    };
  }

  const sample: AdminSource = {
    mode: 'sample',
    listOrders: async (query) => samplePage(query),
    getOrder: async (id) => {
      const found = sampleOrders.find((order) => order.id === id);
      return found ? applySampleProfileToOrder(found) : null;
    },
    getSettings: async () => sampleSettings,
    updateSettings: async () => {
      throw new ApiError({
        code: 'SAMPLE_MODE',
        message: '样例模式不会写入服务端配置。',
        status: 0,
        retryable: false,
      });
    },

    listMerchantAccounts: async () => {
      const snapshot = readSampleMerchantProfileSnapshot();
      return structuredClone(sampleMerchantAccountState).map((item) => {
        if (item.merchantId !== 'demo-merchant-01' || !snapshot) return item;
        return {
          ...item,
          merchantName: snapshot.merchant?.name?.trim() || item.merchantName,
          shopName: snapshot.shop?.name?.trim() || item.shopName || item.merchantName,
          contactName: snapshot.merchant?.contactName?.trim() || item.contactName,
          contactPhone: snapshot.merchant?.contactPhone?.trim() || item.contactPhone,
        };
      });
    },
    createMerchantAccount: async (input) => {
      const created: AdminMerchantAccount = {
        userId: `demo-user-${input.account}`,
        account: input.account,
        password: input.password,
        active: true,
        merchantId: `demo-merchant-${sampleMerchantAccountState.length + 1}`,
        merchantName: input.merchantName,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        createdAt: new Date().toISOString(),
      };
      sampleMerchantAccountState = [...sampleMerchantAccountState, created];
      return structuredClone(created);
    },
  };
  return applySimulation(sample, options.simulateError ?? 'none');
}