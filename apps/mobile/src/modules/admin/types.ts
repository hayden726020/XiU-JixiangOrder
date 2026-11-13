export type AdminRoute = 'overview' | 'orders' | 'orderDetail' | 'settings';

export type DiningMode = 'DINE_IN' | 'TAKEAWAY';

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus = 'SIMULATED_PAID' | 'SIMULATED_REFUNDED';

export type CancelRequestStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type ExceptionFilter = 'ALL' | 'CANCELLATION_PENDING' | 'DELAYED';

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
  reason: string;
  expectedReadyAt: string;
}

export interface Order {
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
  delay: OrderDelay | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  pickedUpAt: string | null;
  merchantId?: string;
  merchantName?: string;
  demo?: boolean;
}

export interface StallSettings {
  stallId: string;
  name: string;
  businessHours: Array<{ start: string; end: string }>;
  enabled: boolean;
}

export interface AlertSettings {
  reservedDineInThreshold: number;
  currentReferenceThreshold: number;
}

export interface AdminSettings {
  canteenId: string;
  canteenName: string;
  centerLabel: string;
  radiusMeters: number;
  accuracyToleranceMeters: number;
  stalls: StallSettings[];
  alerts: AlertSettings;
  version: number;
  updatedAt: string;
  demo: true;
}