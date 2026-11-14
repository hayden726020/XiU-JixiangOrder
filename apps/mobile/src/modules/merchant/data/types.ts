export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type DiningMode = 'DINE_IN' | 'TAKEAWAY';

export type PaymentStatus = 'SIMULATED_PAID' | 'SIMULATED_REFUNDED';

export type CancelRequestStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type MerchantScenario = 'normal' | 'empty' | 'pending-cancel';

export type DishType = 'STAPLE' | 'SNACK' | 'DRINK' | 'SET';

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
  type: DishType | null;
  name: string;
  unitPriceFen: number;
  availableQuantity: number;
  onSale: boolean;
  version: number | null;
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
  version: number | null;
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

export interface UpdateDishInput {
  requestId: string;
  expectedVersion: number | null;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
}

export interface UpdateSlotInput {
  requestId: string;
  expectedVersion: number | null;
  capacity: number;
  enabled: boolean;
}

export type OnboardingStep = 'NONE' | 'REGISTERED' | 'SHOP_CREATED';

export interface MerchantProfile {
  merchant: {
    id: string;
    name: string;
    contactName: string | null;
    contactPhone: string | null;
    status: string;
  } | null;
  shop: {
    id: string;
    name: string;
    location: string | null;
    description: string | null;
    version: number;
  } | null;
  onboardingStep: OnboardingStep;
}

export interface MerchantRegistrationInput {
  requestId: string;
  merchantName: string;
  contactName: string;
  contactPhone: string;
}

export interface CreateShopInput {
  requestId: string;
  shopName: string;
  location: string;
  description: string;
}

export interface CreateDishInput {
  requestId: string;
  type: DishType;
  name: string;
  priceFen: number;
  availableQuantity: number;
  onSale: boolean;
}

export interface MerchantSource {
  mode: 'sample' | 'real';
  scenario: MerchantScenario;
  getOrders: (page?: number, pageSize?: number) => Promise<SourceResult<OrderPage>>;
  getOrder: (id: string) => Promise<SourceResult<MerchantOrder>>;
  getMenu: (date: string) => Promise<SourceResult<MenuDay>>;
  getSlots: (date: string) => Promise<SourceResult<SlotDay>>;
  getProfile: () => Promise<SourceResult<MerchantProfile>>;
  registerMerchant: (input: MerchantRegistrationInput) => Promise<SourceResult<MerchantProfile>>;
  createShop: (input: CreateShopInput) => Promise<SourceResult<MerchantProfile>>;
  createDish: (input: CreateDishInput) => Promise<SourceResult<Dish>>;
  advanceOrder: (id: string, input: AdvanceOrderInput) => Promise<SourceResult<MerchantOrder>>;
  verifyOrder: (id: string, input: VerifyOrderInput) => Promise<SourceResult<MerchantOrder>>;
  decideCancellation: (id: string, input: CancelDecisionInput) => Promise<SourceResult<MerchantOrder>>;
  cancelOrder: (id: string, input: MerchantCancelOrderInput) => Promise<SourceResult<MerchantOrder>>;
  setDelay: (id: string, input: SetDelayInput) => Promise<SourceResult<MerchantOrder>>;
  changeDiningMode: (id: string, input: ChangeDiningModeInput) => Promise<SourceResult<MerchantOrder>>;
  updateDish: (date: string, dishId: string, input: UpdateDishInput) => Promise<SourceResult<Dish>>;
  updateSlot: (date: string, slotId: string, input: UpdateSlotInput) => Promise<SourceResult<Slot>>;
}