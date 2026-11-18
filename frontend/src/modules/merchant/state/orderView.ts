import type {
  CancelRequest,
  DiningMode,
  DiningModeChangeRequest,
  MerchantOrder,
  OrderStatus,
  PaymentStatus,
} from '../data/types';
import { formatYuan } from '../utils/money';

export interface OrderGroup {
  key: string;
  label: string;
  count: number;
  hasPendingCancel: boolean;
  hasPendingRequest: boolean;
  orders: MerchantOrder[];
}

const GROUP_DEFS: ReadonlyArray<{ key: string; label: string; statuses: OrderStatus[] | null }> = [
  { key: 'pending', label: '待处理', statuses: null },
  { key: 'new', label: '待接单', statuses: ['NEW'] },
  { key: 'in-progress', label: '制作中', statuses: ['ACCEPTED', 'PREPARING'] },
  { key: 'ready', label: '可取餐', statuses: ['READY'] },
  { key: 'completed', label: '已完成', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: '已取消', statuses: ['CANCELLED'] },
];

export const STATUS_TRACK: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

const DINING_MODE_VIEWS: Record<DiningMode, { label: string; tone: string; description: string }> = {
  DINE_IN: { label: '堂食', tone: 'dine-in', description: '在档口用餐，按堂食备餐' },
  TAKEAWAY: { label: '外带', tone: 'takeaway', description: '打包带走，按外带备餐' },
};

const STATUS_VIEWS: Record<OrderStatus, { label: string; tone: string }> = {
  NEW: { label: '待接单', tone: 'new' },
  ACCEPTED: { label: '已接单', tone: 'in-progress' },
  PREPARING: { label: '制作中', tone: 'in-progress' },
  READY: { label: '可取餐', tone: 'ready' },
  COMPLETED: { label: '已完成', tone: 'completed' },
  CANCELLED: { label: '已取消', tone: 'cancelled' },
};

const PAYMENT_TEXTS: Record<PaymentStatus, string> = {
  SIMULATED_PAID: '模拟付款，不发生资金交易',
  SIMULATED_REFUNDED: '模拟退款已完成，不发生资金交易',
};

export function hasPendingCancel(order: MerchantOrder): boolean {
  return order.cancelRequest.status === 'PENDING';
}

export function hasPendingDiningModeChange(order: MerchantOrder): boolean {
  return order.diningModeChange.status === 'PENDING';
}

export function hasPendingRequest(order: MerchantOrder): boolean {
  return hasPendingCancel(order) || hasPendingDiningModeChange(order);
}

export function diningModeChangeRoute(request: DiningModeChangeRequest): string {
  const from = request.fromDiningMode
    ? DINING_MODE_VIEWS[request.fromDiningMode].label
    : '原用餐方式';
  const to = request.toDiningMode
    ? DINING_MODE_VIEWS[request.toDiningMode].label
    : '新用餐方式';
  return `${from} → ${to}`;
}

export function pendingRequestSummary(order: MerchantOrder): string | null {
  const parts: string[] = [];
  if (hasPendingCancel(order)) {
    parts.push(`申请退款 ${formatYuan(order.totalFen)}`);
  }
  if (hasPendingDiningModeChange(order)) {
    parts.push(diningModeChangeRoute(order.diningModeChange));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function groupOrders(
  orders: MerchantOrder[],
  options: { includeEmpty?: boolean } = {},
): OrderGroup[] {
  const groups = GROUP_DEFS.map((definition) => {
    const grouped = orders
      .filter((order) => (definition.statuses === null
        ? hasPendingRequest(order)
        : definition.statuses.includes(order.status)))
      .sort((left, right) => {
        if (definition.statuses === null) {
          return left.updatedAt === right.updatedAt
            ? left.id.localeCompare(right.id)
            : (left.updatedAt < right.updatedAt ? 1 : -1);
        }
        return left.createdAt === right.createdAt
          ? left.id.localeCompare(right.id)
          : (left.createdAt < right.createdAt ? 1 : -1);
      });
    return {
      key: definition.key,
      label: definition.label,
      count: grouped.length,
      hasPendingCancel: grouped.some(hasPendingCancel),
      hasPendingRequest: grouped.some(hasPendingRequest),
      orders: grouped,
    };
  });
  return options.includeEmpty ? groups : groups.filter((group) => group.count > 0);
}

export function shortOrderId(id: string): string {
  const uuid = /^ord_([0-9a-f]{8})/i.exec(id);
  if (uuid) {
    return `#${uuid[1]}`;
  }
  const digits = /(\d+)$/.exec(id);
  return digits ? `#${digits[1]}` : id;
}

export function orderNoLabel(order: Pick<MerchantOrder, 'orderNo' | 'id'>): string {
  return order.orderNo === null || order.orderNo === undefined
    ? shortOrderId(order.id)
    : `#${order.orderNo}`;
}

export function formatClock(iso: string): string {
  return iso.slice(11, 16);
}

export function formatDateTime(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

export function localInputToZonedIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const clock = value.length >= 16 ? value.slice(0, 16) : value;
  return `${clock}:00${sign}${hours}:${minutes}`;
}

export function formatSlot(order: MerchantOrder): string {
  return `${formatClock(order.slotStart)}—${formatClock(order.slotEnd)}`;
}

export function diningModeView(mode: DiningMode): { label: string; tone: string; description: string } {
  return { ...DINING_MODE_VIEWS[mode] };
}

export function statusView(status: OrderStatus): { label: string; tone: string } {
  return { ...STATUS_VIEWS[status] };
}

export function paymentText(status: PaymentStatus): string {
  return PAYMENT_TEXTS[status];
}

export function cancelRequestLabel(request: CancelRequest): string {
  if (request.status === 'PENDING') return '学生申请取消，请优先处理；申请不等于已取消';
  if (request.status === 'APPROVED') return '取消申请已批准';
  if (request.status === 'REJECTED') return '取消申请已拒绝';
  return '无取消申请';
}

export function diningModeChangeLabel(request: DiningModeChangeRequest): string {
  if (request.status === 'PENDING') return '学生申请变更用餐方式，请优先处理；当前用餐方式尚未改变';
  if (request.status === 'APPROVED') return '用餐方式变更已同意';
  if (request.status === 'REJECTED') return '用餐方式变更已拒绝';
  return '无用餐方式变更申请';
}
export function cancellationNote(order: MerchantOrder): string {
  if (order.cancelRequest.status === 'APPROVED') {
    return '学生申请取消';
  }
  return order.cancellationReason ?? '未填写原因';
}