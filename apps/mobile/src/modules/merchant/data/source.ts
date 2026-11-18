import { ApiError, apiRequest } from '../../../shared/apiClient';
import { getSession } from '../../../shared/session';

import { sampleMenu, sampleOrders, sampleSlots, SAMPLE_DATES } from './sampleData';
import type {
  CreateDishInput,
  CreateShopInput,

  DeletedDish,
  Dish,
  DishType,
  MenuDay,
  MerchantAccount,
  MerchantOrder,
  MerchantProfile,
  MerchantProfileUpdateInput,
  MerchantRegistrationInput,
  MerchantScenario,
  OnboardingStep,
  UpdateMerchantAccountInput,
  WalletEntry,
  WalletSummary,
  WalletWithdrawInput,
  MerchantSource,
  OrderPage,
  Slot,
  SlotDay,
  SourceResult,
} from './types';

interface ApiDish {
  id: string;
  merchantId: string;
  type?: string | null;
  name: string;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
  version?: number;
  imageUrl?: string | null;
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
  orderNo?: number | null;
  items: ApiOrderItem[];
  slotId: string;
  slotStart: string;
  slotEnd: string;
  diningMode: MerchantOrder['diningMode'];
  diningModeReason?: string | null;
  totalFen: number;
  packagingFeeFen?: number | null;
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
  remark?: string | null;
}

interface ApiMerchantOrders {
  orders: ApiOrder[];
  page: number;
  pageSize: number;
  total: number;
}

interface ApiMerchantProfile {
  merchant?: {
    id?: string;
    name?: string;
    contactName?: string | null;
    contactPhone?: string | null;
    status?: string;
  } | null;
  shop?: {
    id?: string;
    name?: string;
    location?: string | null;
    description?: string | null;
    version?: number;
  } | null;

  onboardingStep?: string;
}

interface ApiMerchantAccount {
  userId?: string;
  account?: string;
  password?: string | null;
  active?: boolean;
  merchantId?: string | null;
  merchantName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  createdAt?: string | null;
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

function apiDishType(value: unknown): DishType | null {
  return value === 'STAPLE' || value === 'SNACK' || value === 'DRINK' || value === 'SET'
    ? value
    : null;
}

function apiImageUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function mapDish(dish: ApiDish): Dish {
  return {
    dishId: dish.id,
    type: apiDishType(dish.type),
    name: dish.name,
    unitPriceFen: dish.priceFen,
    availableQuantity: dish.availableQuantity,
    onSale: dish.onSale,
    version: apiVersion(dish.version),
    imageUrl: apiImageUrl(dish.imageUrl),
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

const ONBOARDING_STEPS: OnboardingStep[] = [
  'NONE',
  'UNREGISTERED',
  'REGISTERED',
  'SHOP_CREATED',
];

function resolveOnboardingStep(
  raw: string | undefined,
  merchant: unknown,
  shop: unknown,
): OnboardingStep {
  if (typeof raw === 'string' && ONBOARDING_STEPS.includes(raw as OnboardingStep)) {
    return raw as OnboardingStep;
  }
  if (shop) return 'SHOP_CREATED';
  return merchant ? 'REGISTERED' : 'NONE';
}

function mapAccount(payload: ApiMerchantAccount): MerchantAccount {
  return {
    userId: payload.userId ?? '',
    account: payload.account ?? '',
    password: payload.password ?? null,
    active: payload.active !== false,
    merchantId: payload.merchantId ?? null,
    merchantName: payload.merchantName ?? null,
    contactName: payload.contactName ?? null,
    contactPhone: payload.contactPhone ?? null,
    createdAt: payload.createdAt ?? null,
  };
}

function mapProfile(payload: ApiMerchantProfile): SourceResult<MerchantProfile> {
  if (typeof payload !== 'object' || payload === null) {
    return fail('INVALID_RESPONSE', '商家资料响应格式不正确。');
  }
  const merchant = payload.merchant ?? null;
  const shop = payload.shop ?? null;

  if (
    merchant !== null
    && (typeof merchant.id !== 'string' || typeof merchant.name !== 'string')
  ) {
    return fail('INVALID_RESPONSE', '商家资料响应缺少商家 id 或名称。');
  }
  if (
    shop !== null
    && (typeof shop.id !== 'string' || typeof shop.name !== 'string')
  ) {
    return fail('INVALID_RESPONSE', '商家资料响应缺少店铺 id 或名称。');
  }
  return {
    ok: true,
    data: {
      merchant: merchant
        ? {
          id: merchant.id as string,
          name: merchant.name as string,
          contactName: merchant.contactName ?? null,
          contactPhone: merchant.contactPhone ?? null,
          status: merchant.status ?? 'ACTIVE',
        }
        : null,
      shop: shop
        ? {
          id: shop.id as string,
          name: shop.name as string,
          location: shop.location ?? null,
          description: shop.description ?? null,
          version: Number.isFinite(shop.version) ? (shop.version as number) : 1,
        }
        : null,
      onboardingStep: resolveOnboardingStep(payload.onboardingStep, merchant, shop),
    },
  };
}

function toOnboardingFailure<T>(error: unknown, label: string): SourceResult<T> {
  if (error instanceof ApiError) {
    if (error.code === 'NOT_FOUND') {
      return fail(
        'ONBOARDING_API_MISSING',
        `共同服务尚未提供${label}接口；本次未保存，页面不显示成功。`,
      );
    }
    return fail(error.code, error.message, error.retryable);
  }
  return fail('UNKNOWN_ERROR', `${label}未完成，请稍后重试。`);
}

function mapOrder(order: ApiOrder): MerchantOrder {
  return {
    id: order.id,
    orderNo: typeof order.orderNo === 'number' ? order.orderNo : null,
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
    packagingFeeFen: typeof order.packagingFeeFen === 'number' && order.packagingFeeFen > 0
      ? order.packagingFeeFen
      : null,
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
    remark: typeof order.remark === 'string' && order.remark.trim().length > 0
      ? order.remark
      : null,
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

  function loadMenu(date: string, merchantId: string): Promise<SourceResult<ApiMenu>> {
    const key = `${date}:${merchantId}`;
    const running = inFlightMenus.get(key);
    if (running) return running;
    const request = apiRequest<ApiMenu>(
      `/menu?date=${encodeURIComponent(date)}&merchantId=${encodeURIComponent(merchantId)}`,
    )
      .then((data): SourceResult<ApiMenu> => ({ ok: true, data }))
      .catch((error: unknown): SourceResult<ApiMenu> => toFailure<ApiMenu>(error))
      .finally(() => inFlightMenus.delete(key));
    inFlightMenus.set(key, request);
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
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不读取订单。');
      }
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
      const result = await loadMenu(date, merchantId);
      return result.ok ? mapMenu(result.data, merchantId) : result;
    },
    getDishLibrary: async (_date: string) => (
      fail(
        'UNSUPPORTED',
        '真实服务暂未提供菜品库接口，制作每日菜单先在样例模式使用；字段需求已记录。',
      )
    ),
    setDailyMenu: async (_date: string) => (
      fail(
        'UNSUPPORTED',
        '真实服务暂未提供每日菜单接口，制作每日菜单先在样例模式使用；字段需求已记录。',
      )
    ),
    getSlots: async (date: string) => {
      const merchantId = currentMerchantId();
      if (!merchantId) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不读取时段。');
      }
      const result = await loadMenu(date, merchantId);
      return result.ok ? mapSlots(result.data) : result;
    },
    getProfile: async () => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不读取商家资料。');
      }
      try {
        const data = await apiRequest<ApiMerchantProfile>('/merchant/profile');
        return mapProfile(data);
      } catch (error) {
        return toOnboardingFailure(error, '商家资料查询');
      }
    },
    getWallet: async (): Promise<SourceResult<WalletSummary>> => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不读取钱包。');
      }
      return fail('NOT_IMPLEMENTED', '钱包暂未接入共同服务；余额与提现暂不可用。');
    },
    withdrawWallet: async (): Promise<SourceResult<WalletSummary>> => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不操作钱包。');
      }
      return fail('NOT_IMPLEMENTED', '钱包暂未接入共同服务；提现暂不可用。');
    },
    updateProfile: async (input: MerchantProfileUpdateInput) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不保存资料。');
      }
      const merchantBody: Record<string, unknown> = {};
      if (input.contactName !== undefined) merchantBody.contactName = input.contactName;
      if (input.contactPhone !== undefined) merchantBody.contactPhone = input.contactPhone;
      const shopBody: Record<string, unknown> = {};
      if (input.shopName !== undefined) shopBody.shopName = input.shopName;
      if (input.location !== undefined) shopBody.location = input.location;
      if (input.description !== undefined) shopBody.description = input.description;

      if (Object.keys(merchantBody).length === 0 && Object.keys(shopBody).length === 0) {
        return fail('VALIDATION_ERROR', '没有需要保存的资料字段。');
      }
      try {
        let nextProfile: MerchantProfile | null = null;
        if (Object.keys(merchantBody).length > 0) {
          const data = await apiRequest<ApiMerchantProfile>('/merchant/profile', {
            method: 'PATCH',
            body: { requestId: input.requestId, ...merchantBody },
          });
          const mapped = mapProfile(data);
          if (!mapped.ok) return mapped;
          nextProfile = mapped.data;
        }
        if (Object.keys(shopBody).length > 0) {
          if (!input.shopId) {
            return fail('VALIDATION_ERROR', '缺少店铺标识，请刷新页面后重试。');
          }
          if (input.shopVersion === undefined) {
            return fail('SHOP_VERSION_MISSING', '服务端未返回店铺版本，暂不能安全保存店铺资料。');
          }
          const data = await apiRequest<ApiMerchantProfile>(
            `/merchant/shops/${encodeURIComponent(input.shopId)}`,
            {
              method: 'PATCH',
              body: {
                requestId: `${input.requestId}-shop`,
                expectedVersion: input.shopVersion,
                ...shopBody,
              },
            },
          );
          const mapped = mapProfile(data);
          if (!mapped.ok) return mapped;
          nextProfile = mapped.data;
        }
        if (!nextProfile) {
          return fail('VALIDATION_ERROR', '没有需要保存的资料字段。');
        }
        return { ok: true, data: nextProfile };
      } catch (error) {
        return toOnboardingFailure(error, '商家资料修改');
      }
    },
    registerMerchant: async (input: MerchantRegistrationInput) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送注册请求。');
      }
      const session = getSession();
      const accountName = session?.user.role === 'MERCHANT'
        ? session.user.displayName.trim()
        : '';
      const merchantName = accountName.length >= 2
        ? accountName.slice(0, 30)
        : (input.merchantName?.trim() || `${input.contactName.trim()}的档口`);
      try {
        const data = await apiRequest<ApiMerchantProfile>('/merchant/registration', {
          method: 'POST',
          body: {
            requestId: input.requestId,
            merchantName,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
          },
        });
        return mapProfile(data);
      } catch (error) {
        return toOnboardingFailure(error, '商家注册');
      }
    },
    createShop: async (input: CreateShopInput) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送店铺创建请求。');
      }
      try {
        const data = await apiRequest<ApiMerchantProfile>('/merchant/shops', {
          method: 'POST',
          body: {
            requestId: input.requestId,
            shopName: input.shopName,
            location: input.location,
            description: input.description,
          },
        });
        return mapProfile(data);
      } catch (error) {
        return toOnboardingFailure(error, '店铺创建');
      }
    },

    getAccount: async () => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不读取账号信息。');
      }
      try {
        const data = await apiRequest<ApiMerchantAccount>('/merchant/account');
        return { ok: true, data: mapAccount(data) };
      } catch (error) {
        return toFailure(error, '账号信息读取失败，请稍后重试。');
      }
    },
    updateAccount: async (input: UpdateMerchantAccountInput) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不保存账号信息。');
      }
      try {
        const data = await apiRequest<ApiMerchantAccount>('/merchant/account', {
          method: 'PATCH',
          body: {
            requestId: input.requestId,
            account: input.account,
            password: input.password,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
          },
        });
        return { ok: true, data: mapAccount(data) };
      } catch (error) {
        return toFailure(error, '账号信息保存失败，请稍后重试。');
      }
    },
    createDish: async (input: CreateDishInput) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送菜品创建请求。');
      }
      try {
        const data = await apiRequest<ApiDish>('/merchant/menu', {
          method: 'POST',
          body: {
            requestId: input.requestId,
            type: input.type,
            name: input.name,
            priceFen: input.priceFen,
            availableQuantity: input.availableQuantity,
            onSale: input.onSale,
          },
        });
        if (typeof data.id !== 'string') {
          return fail('INVALID_RESPONSE', '菜品创建响应缺少 id。');
        }
        return { ok: true, data: mapDish(data) };
      } catch (error) {
        return toOnboardingFailure(error, '菜品创建');
      }
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
            name: input.name,
            type: input.type,
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
    deleteDish: async (_date, dishId, input) => {
      if (!currentMerchantId()) {
        return fail('UNAUTHENTICATED', '真实模式需要先登录档口演示账号，未登录不发送删除请求。');
      }
      if (input.expectedVersion === null || !Number.isFinite(input.expectedVersion)) {
        return fail(
          'MENU_VERSION_MISSING',
          '服务端 GET /menu 未返回菜品 version，暂不能安全删除；已记录给后端补字段。',
        );
      }
      try {
        const data = await apiRequest<{ id?: string } | undefined>(
          `/merchant/menu/${encodeURIComponent(dishId)}`,
          {
            method: 'DELETE',
            body: {
              requestId: input.requestId,
              expectedVersion: input.expectedVersion,
            },
          },
        );
        const returnedId = typeof data?.id === 'string' ? data.id : dishId;
        return { ok: true, data: { dishId: returnedId } };
      } catch (error) {
        return toFailure(error, '删除菜品失败，请重新读取菜单后重试。');
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

const SAMPLE_PROFILE_STORAGE_KEY = 'merchant-sample-profile-v1';

function emptyProfile(): MerchantProfile {
  return { merchant: null, shop: null, onboardingStep: 'NONE' };
}

function readSampleProfile(): MerchantProfile {
  if (typeof window === 'undefined') return emptyProfile();
  try {
    const raw = window.localStorage.getItem(SAMPLE_PROFILE_STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<MerchantProfile> | null;
    if (!parsed || typeof parsed !== 'object') return emptyProfile();
    const merchant = parsed.merchant ?? null;
    const shop = parsed.shop ?? null;
    if (merchant && (typeof merchant.name !== 'string' || typeof merchant.id !== 'string')) {
      return emptyProfile();
    }
    if (shop && (typeof shop.name !== 'string' || typeof shop.id !== 'string')) {
      return emptyProfile();
    }
    return {
      merchant,
      shop,

      onboardingStep: parsed.onboardingStep
        ?? (shop ? 'SHOP_CREATED' : merchant ? 'REGISTERED' : 'NONE'),
    };
  } catch {
    return emptyProfile();
  }
}

function persistSampleProfile(profile: MerchantProfile): void {

  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SAMPLE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    return;
  }
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
  const dishWrites = new Map<string, { name: string; type: DishType; unitPriceFen: number; availableQuantity: number; onSale: boolean; version: number }>();
  const slotWrites = new Map<string, { capacity: number; enabled: boolean; version: number }>();
  const addedDishes = new Map<string, Dish>();
  const deletedDishes = new Set<string>();
  const dailyMenus = new Map<string, Set<string>>();
  let nextDishId = 1;

  function applyDishOverride(date: string, dish: Dish): Dish {
    const override = dishWrites.get(`${date}:${dish.dishId}`);
    return override ? { ...dish, ...override } : dish;
  }

  function libraryDishes(date: string): Dish[] {
    const merged = new Map<string, Dish>();
    for (const day of SAMPLE_DATES) {
      for (const dish of sampleMenu(day)?.dishes ?? []) {
        merged.set(dish.dishId, dish);
      }
    }
    for (const dish of addedDishes.values()) {
      merged.set(dish.dishId, dish);
    }
    for (const dish of sampleMenu(date)?.dishes ?? []) {
      merged.set(dish.dishId, dish);
    }
    return [...merged.values()].filter((dish) => !deletedDishes.has(dish.dishId));
  }

  function selectedDishIds(date: string): Set<string> {
    const override = dailyMenus.get(date);
    if (override) return override;
    return new Set((sampleMenu(date)?.dishes ?? []).map((dish) => dish.dishId));
  }

  function computeMenu(date: string): MenuDay | null {
    const menu = sampleMenu(date);
    if (!menu) return null;
    const ids = selectedDishIds(date);
    const dishes = libraryDishes(date)
      .filter((dish) => ids.has(dish.dishId))
      .map((dish) => applyDishOverride(date, dish));
    return { ...menu, dishes };
  }

  function findSampleDish(date: string, dishId: string): Dish | null {
    if (deletedDishes.has(dishId)) return null;
    const base = libraryDishes(date).find((dish) => dish.dishId === dishId);
    return base ? applyDishOverride(date, base) : null;
  }
  let walletEntries: WalletEntry[] = [
    { id: 'wallet-in-1', kind: 'income', label: '订单收入 · 演示鸡肉饭', amountFen: 1800, createdAt: '2026-11-13T12:05:00+08:00' },
    { id: 'wallet-in-2', kind: 'income', label: '订单收入 · 演示素面', amountFen: 1600, createdAt: '2026-11-13T12:10:00+08:00' },
    { id: 'wallet-in-3', kind: 'income', label: '订单收入 · 演示素面 ×2', amountFen: 3200, createdAt: '2026-11-13T11:55:00+08:00' },
    { id: 'wallet-out-1', kind: 'withdraw', label: '演示提现到银行卡', amountFen: 2000, createdAt: '2026-11-13T18:00:00+08:00' },
  ];
  const walletBalance = (): number => walletEntries.reduce(
    (sum, entry) => (entry.kind === 'income' ? sum + entry.amountFen : sum - entry.amountFen),
    0,
  );
  const walletSummary = (): WalletSummary => ({
    balanceFen: walletBalance(),
    totalIncomeFen: walletEntries
      .filter((entry) => entry.kind === 'income')
      .reduce((sum, entry) => sum + entry.amountFen, 0),
    totalWithdrawnFen: walletEntries
      .filter((entry) => entry.kind === 'withdraw')
      .reduce((sum, entry) => sum + entry.amountFen, 0),
    entries: [...walletEntries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => ({ ...entry })),
  });

  let sampleProfile: MerchantProfile = readSampleProfile();

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
      const menu = computeMenu(date);
      if (!menu) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: menu };
    },
    getDishLibrary: async (date: string): Promise<SourceResult<Dish[]>> => {
      if (!sampleMenu(date)) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: structuredClone(libraryDishes(date)) };
    },
    setDailyMenu: async (date: string, input): Promise<SourceResult<MenuDay>> => {
      const base = sampleMenu(date);
      if (!base) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      const library = new Map(libraryDishes(date).map((dish) => [dish.dishId, dish]));
      const ids = new Set<string>();
      for (const item of input.dishes) {
        const dish = library.get(item.dishId);
        if (!dish) return fail('DISH_NOT_FOUND', `菜品 ${item.dishId} 不存在，请重新读取菜品库。`);
        if (ids.has(item.dishId)) return fail('VALIDATION_ERROR', '同一道菜不能重复上架。');
        if (
          !Number.isSafeInteger(item.availableQuantity)
          || item.availableQuantity < 0
          || item.availableQuantity > 10_000
        ) {
          return fail('VALIDATION_ERROR', `「${dish.name}」的今日库存必须是 0—10000 的整数。`);
        }
        ids.add(item.dishId);
        const key = `${date}:${item.dishId}`;
        const current = dishWrites.get(key);
        dishWrites.set(key, {
          name: current?.name ?? dish.name,
          type: current?.type ?? dish.type ?? 'STAPLE',
          unitPriceFen: current?.unitPriceFen ?? dish.unitPriceFen,
          availableQuantity: item.availableQuantity,
          onSale: current?.onSale ?? dish.onSale,
          version: (current?.version ?? dish.version ?? 1) + 1,
        });
      }
      dailyMenus.set(date, ids);
      const menu = computeMenu(date);
      if (!menu) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: menu };
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
    getWallet: async (): Promise<SourceResult<WalletSummary>> => ({ ok: true, data: walletSummary() }),
    withdrawWallet: async (input: WalletWithdrawInput): Promise<SourceResult<WalletSummary>> => {
      if (!Number.isSafeInteger(input.amountFen) || input.amountFen <= 0) {
        return fail('VALIDATION_ERROR', '提现金额必须是大于 0 的整数（单位：分）。');
      }
      const balance = walletBalance();
      if (input.amountFen > balance) {
        return fail('VALIDATION_ERROR', '演示提现金额超出样例余额，请调整金额。');
      }
      walletEntries.push({
        id: `wallet-out-${Date.now()}`,
        kind: 'withdraw',
        label: '演示提现到银行卡',
        amountFen: input.amountFen,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, data: walletSummary() };
    },
    getProfile: async (): Promise<SourceResult<MerchantProfile>> => (
      { ok: true, data: structuredClone(sampleProfile) }
    ),
    updateProfile: async (input: MerchantProfileUpdateInput): Promise<SourceResult<MerchantProfile>> => {
      if (!sampleProfile.merchant) {
        return fail('MERCHANT_REQUIRED', '请先完成商家注册，再修改我的信息。');
      }
      const contactName = input.contactName?.trim() || sampleProfile.merchant.contactName || '';
      const contactPhone = input.contactPhone?.trim().replace(/[\s-]/g, '')
        || sampleProfile.merchant.contactPhone
        || '';
      const shop = sampleProfile.shop;
      const nextShop = shop
        ? {
          ...shop,
          name: input.shopName?.trim() || shop.name,
          location: input.location?.trim() || shop.location,
          description: input.description === undefined
            ? shop.description
            : input.description?.trim()
              ? input.description.trim()
              : null,
          version: shop.version + 1,
        }
        : null;
      sampleProfile = {
        ...sampleProfile,
        merchant: {
          ...sampleProfile.merchant,
          contactName,
          contactPhone,
        },
        shop: nextShop,
      };
      persistSampleProfile(sampleProfile);
      return { ok: true, data: structuredClone(sampleProfile) };
    },
    registerMerchant: async (input: MerchantRegistrationInput): Promise<SourceResult<MerchantProfile>> => {
      sampleProfile = {
        merchant: {
          id: 'demo-merchant-01',
          name: input.merchantName?.trim() || sampleProfile.merchant?.name || '未命名商家',
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          status: 'ACTIVE',
        },
        shop: null,
        onboardingStep: 'REGISTERED',
      };
      persistSampleProfile(sampleProfile);
      return { ok: true, data: structuredClone(sampleProfile) };
    },
    createShop: async (input: CreateShopInput): Promise<SourceResult<MerchantProfile>> => {
      if (!sampleProfile.merchant) {
        return fail('MERCHANT_REQUIRED', '请先完成商家注册。');
      }

      sampleProfile = {
        ...sampleProfile,
        shop: {
          id: 'demo-shop-01',
          name: input.shopName,
          location: input.location,
          description: input.description.trim().length > 0 ? input.description : null,
          version: 1,
        },
        onboardingStep: 'SHOP_CREATED',
      };
      persistSampleProfile(sampleProfile);
      return { ok: true, data: structuredClone(sampleProfile) };
    },

    getAccount: async (): Promise<SourceResult<MerchantAccount>> => ({
      ok: true,
      data: {
        userId: 'demo-user-merchant-01',
        account: 'demo-merchant',
        password: 'demo-pass',
        active: true,
        merchantId: sampleProfile.merchant?.id ?? null,
        merchantName: sampleProfile.merchant?.name ?? null,
        contactName: sampleProfile.merchant?.contactName ?? null,
        contactPhone: sampleProfile.merchant?.contactPhone ?? null,
        createdAt: null,
      },
    }),
    updateAccount: async (input: UpdateMerchantAccountInput): Promise<SourceResult<MerchantAccount>> => {
      const merchant = sampleProfile.merchant;
      if (!merchant) {
        return fail('MERCHANT_REQUIRED', '请先完成商家注册。');
      }
      const contactName = input.contactName?.trim() || merchant.contactName || '';
      const contactPhone = input.contactPhone?.trim().replace(/[\s-]/g, '')
        || merchant.contactPhone
        || '';
      sampleProfile = {
        ...sampleProfile,
        merchant: {
          ...merchant,
          contactName,
          contactPhone,
        },
      };
      persistSampleProfile(sampleProfile);
      return {
        ok: true,
        data: {
          userId: 'demo-user-merchant-01',
          account: input.account?.trim() || 'demo-merchant',
          password: input.password || 'demo-pass',
          active: true,
          merchantId: merchant.id,
          merchantName: merchant.name,
          contactName,
          contactPhone,
          createdAt: null,
        },
      };
    },
    createDish: async (input: CreateDishInput): Promise<SourceResult<Dish>> => {
      const targetDate = (input as CreateDishInput & { date?: string }).date;
      const dish: Dish = {
        dishId: `demo-dish-onboarding-${nextDishId}`,
        type: input.type,
        name: input.name,
        unitPriceFen: input.priceFen,
        availableQuantity: input.availableQuantity,
        onSale: input.onSale,
        version: 1,
        imageUrl: null,
      };
      nextDishId += 1;
      addedDishes.set(dish.dishId, structuredClone(dish));
      if (targetDate && (SAMPLE_DATES as ReadonlyArray<string>).includes(targetDate)) {
        const ids = new Set(selectedDishIds(targetDate));
        ids.add(dish.dishId);
        dailyMenus.set(targetDate, ids);
      }
      return { ok: true, data: structuredClone(dish) };
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

    updateDish: async (date, dishId, input): Promise<SourceResult<Dish>> => {
      const current = findSampleDish(date, dishId);
      if (!current) return fail('DISH_NOT_FOUND', '菜品不存在、已删除或不属于当前样例日期。');
      const version = current.version ?? 1;
      if (input.expectedVersion === null || input.expectedVersion !== version) {
        return fail('ORDER_VERSION_CONFLICT', '菜品已在其他操作中更新，请重新读取菜单后再保存。');
      }
      const updated: Dish = {
        ...current,
        name: input.name,
        type: input.type,
        unitPriceFen: input.priceFen,
        availableQuantity: input.availableQuantity,
        onSale: input.onSale,
        version: version + 1,
      };
      dishWrites.set(`${date}:${dishId}`, {
        name: updated.name,
        type: input.type,
        unitPriceFen: updated.unitPriceFen,
        availableQuantity: updated.availableQuantity,
        onSale: updated.onSale,
        version: updated.version ?? version + 1,
      });
      return { ok: true, data: updated };
    },
    deleteDish: async (date, dishId, input): Promise<SourceResult<DeletedDish>> => {
      const current = findSampleDish(date, dishId);
      if (!current) return fail('DISH_NOT_FOUND', '菜品不存在或已删除，请重新读取菜单。');
      const version = current.version ?? 1;
      if (input.expectedVersion === null || input.expectedVersion !== version) {
        return fail('ORDER_VERSION_CONFLICT', '菜品已在其他操作中更新，请重新读取菜单后再删除。');
      }
      deletedDishes.add(dishId);
      addedDishes.delete(dishId);
      for (const key of [...dishWrites.keys()]) {
        if (key.endsWith(`:${dishId}`)) {
          dishWrites.delete(key);
        }
      }
      for (const selection of dailyMenus.values()) {
        selection.delete(dishId);
      }
      return { ok: true, data: { dishId } };
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