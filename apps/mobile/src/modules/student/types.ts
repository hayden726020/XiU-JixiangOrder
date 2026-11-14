import { ApiError } from '../../shared/apiClient';

export { ApiError };

export type DiningMode = 'DINE_IN' | 'TAKEAWAY';

export type StudentMode = 'sample' | 'real';

export type DemoScenario = 'normal' | 'slot-full' | 'out-of-stock' | 'timeout';

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus = 'SIMULATED_PAID' | 'SIMULATED_REFUNDED';

export type CancelRequestStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type CrowdLevel = 'CROWDED' | 'NO_ALERT' | 'UNKNOWN';

export type CrowdBasis = 'RESERVATION' | 'LOCATION' | 'PICKUP';

export interface DishDto {
  dishId: string;
  name: string;
  unitPriceFen: number;
  availableQuantity: number;
  onSale: boolean;
}

export interface SlotDto {
  slotId: string;
  slotStart: string;
  slotEnd: string;
  remainingCapacity: number;
  enabled: boolean;
}

export interface MenuResponse {
  date: string;
  /** 真实响应缺少 demo 字段时按 false 处理，只有样例数据明确为 true。 */
  demo: boolean;
  dishes: DishDto[];
  slots: SlotDto[];
}

export interface CrowdReference {
  canteenId: string;
  slotId: string;
  referenceScope: 'PLATFORM_ONLY';
  reservedDineInUsers: number | null;
  currentReferenceUsers: number | null;
  level: CrowdLevel;
  basis: CrowdBasis[];
  updatedAt: string;
  expiresAt: string;
  demo: boolean;
  message: string;
}

export interface OrderItem {
  dishId: string;
  name: string;
  quantity: number;
  unitPriceFen: number;
}

export interface CancelRequest {
  status: CancelRequestStatus;
  reason: string | null;
}

export interface OrderDelay {
  reason: string | null;
  expectedReadyAt: string;
}

export interface StudentOrder {
  id: string;
  items: OrderItem[];
  slotId: string;
  slotStart: string;
  slotEnd: string;
  diningMode: DiningMode;
  totalFen: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  cancelRequest: CancelRequest;
  cancellationReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  pickedUpAt: string | null;
  delay: OrderDelay | null;
  pickupCode: string | null;
  demo: boolean;
  local?: boolean;
}

export interface DraftItemInput {
  dishId: string;
  quantity: number;
}

export interface CreateOrderInput {
  requestId: string;
  items: DraftItemInput[];
  slotId: string;
  diningMode: DiningMode;
}

export interface QueryOrderResultInput {
  requestId: string;
  items?: DraftItemInput[];
  slotId?: string | null;
  diningMode?: DiningMode | null;
}

export interface StudentSource {
  mode: StudentMode;
  getMenu(date: string): Promise<MenuResponse>;
  getCrowd(slotId: string): Promise<CrowdReference>;
  createOrder(input: CreateOrderInput): Promise<StudentOrder>;
  queryOrderResult(input: QueryOrderResultInput | string): Promise<StudentOrder>;
  getOrder(id: string): Promise<StudentOrder>;
  setScenario(next: DemoScenario): DemoScenario;
  getScenario(): DemoScenario;
}

export interface SourceError {
  code: string;
  message: string;
  retryable: boolean;
  dishNames?: string[];
}

export type ApiErrorWithDishNames = ApiError & { dishNames?: string[] };

/**
 * 统一构造 shared ApiError，避免模块内出现第二套错误类。
 * 样例/本地校验没有 HTTP 状态，status 固定为 0；真实请求由 apiRequest 填充状态。
 */
export function apiError(code: string, message: string, retryable = false): ApiError {
  return new ApiError({ code, message, status: 0, retryable });
}

export function apiErrorWithDishNames(
  code: string,
  message: string,
  dishNames: string[],
): ApiErrorWithDishNames {
  const error = apiError(code, message, false);
  return Object.assign(error, { dishNames: dishNames.slice() });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function readDishNames(error: ApiError): string[] | undefined {
  const value = (error as ApiErrorWithDishNames).dishNames;
  if (!Array.isArray(value)) {
    return undefined;
  }
  const kept = value.filter((name): name is string => typeof name === 'string' && name.trim() !== '');
  return kept.length > 0 ? kept : undefined;
}

export function toSourceError(error: unknown): SourceError {
  if (isApiError(error)) {
    const dishNames = readDishNames(error);
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(dishNames ? { dishNames } : {}),
    };
  }
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : '提交失败，请稍后重试。',
    retryable: false,
  };
}