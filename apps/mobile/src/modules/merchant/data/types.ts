export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type DiningMode = 'DINE_IN' | 'TAKEAWAY';

export type PaymentStatus = 'SIMULATED_PAID' | 'SIMULATED_REFUNDED';

export type CancelRequestStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type MerchantScenario = 'normal' | 'empty' | 'pending-cancel';

export interface OrderItem {
  dishId: string;
  name: string;
  quantity: number;
  unitPriceFen: number;
}

export interface CancelRequest {
  status: CancelRequestStatus;
  reason: string | null;
  decisionReason: string | null;
}

export interface OrderDelay {
  reason: string;
  expectedReadyAt: string;
}

export interface MerchantOrder {
  id: string;
  items: OrderItem[];
  slotId: string;
  slotStart: string;
  slotEnd: string;
  diningMode: DiningMode;
  diningModeReason: string | null;
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
}

export interface Dish {
  dishId: string;
  name: string;
  unitPriceFen: number;
  availableQuantity: number;
  onSale: boolean;
}

export interface MenuDay {
  date: string;
  demo: boolean;
  dishes: Dish[];
}

export interface Slot {
  slotId: string;
  slotStart: string;
  slotEnd: string;
  capacity: number;
  occupied: number;
  remaining: number;
  enabled: boolean;
  full: boolean;
}

export interface SlotDay {
  date: string;
  demo: boolean;
  slots: Slot[];
}

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

export type SourceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface OrderPage {
  orders: MerchantOrder[];
  page: number;
  pageSize: number;
  total: number;
}

export type OrderAdvanceAction = 'ACCEPT' | 'START_PREPARING' | 'MARK_READY';

export interface AdvanceOrderInput {
  action: OrderAdvanceAction;
  expectedVersion: number;
  requestId: string;
}

export interface VerifyOrderInput {
  pickupCode: string;
  expectedVersion: number;
  requestId: string;
}

export type CancelDecision = 'APPROVE' | 'REJECT';

export interface CancelDecisionInput {
  decision: CancelDecision;
  reason: string;
  expectedVersion: number;
  requestId: string;
}

export interface MerchantCancelOrderInput {
  reason: string;
  expectedVersion: number;
  requestId: string;
}

export interface SetDelayInput {
  reason: string;
  expectedReadyAt: string;
  expectedVersion: number;
  requestId: string;
}

export interface ChangeDiningModeInput {
  diningMode: DiningMode;
  reason: string;
  expectedVersion: number;
  requestId: string;
}

export interface MerchantSource {
  mode: 'sample' | 'real';
  scenario: MerchantScenario;
  getOrders: (page?: number, pageSize?: number) => Promise<SourceResult<OrderPage>>;
  getOrder: (id: string) => Promise<SourceResult<MerchantOrder>>;
  getMenu: (date: string) => Promise<SourceResult<MenuDay>>;
  getSlots: (date: string) => Promise<SourceResult<SlotDay>>;
  advanceOrder: (id: string, input: AdvanceOrderInput) => Promise<SourceResult<MerchantOrder>>;
  verifyOrder: (id: string, input: VerifyOrderInput) => Promise<SourceResult<MerchantOrder>>;
  decideCancellation: (id: string, input: CancelDecisionInput) => Promise<SourceResult<MerchantOrder>>;
  cancelOrder: (id: string, input: MerchantCancelOrderInput) => Promise<SourceResult<MerchantOrder>>;
  setDelay: (id: string, input: SetDelayInput) => Promise<SourceResult<MerchantOrder>>;
  changeDiningMode: (id: string, input: ChangeDiningModeInput) => Promise<SourceResult<MerchantOrder>>;
}