import type {
  DiningMode,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  StudentMode,
  StudentOrder,
} from '../types';
import { formatYuan } from './money';

const STEPS = ['已下单', '已接单', '制作中', '可取餐', '已完成'];

const STATUS_VIEW: Record<OrderStatus, { label: string; activeIndex: number }> = {
  NEW: { label: '待接单', activeIndex: 0 },
  ACCEPTED: { label: '已接单', activeIndex: 1 },
  PREPARING: { label: '制作中', activeIndex: 2 },
  READY: { label: '可取餐', activeIndex: 3 },
  COMPLETED: { label: '已完成', activeIndex: 4 },
  CANCELLED: { label: '已取消', activeIndex: -1 },
};

const DINING_MODE_TEXT: Record<DiningMode, string> = {
  DINE_IN: '堂食',
  TAKEAWAY: '外带',
};

const CANCEL_RULE_TEXT = '接单前可直接取消；接单后需提交申请，由档口处理。';
const CHANGE_DINING_RULE_TEXT =
  '如需更改堂食或外带，请联系档口，由档口确认后更新；学生端只展示结果，不提交变更申请。';
const PAYMENT_TEXT: Record<PaymentStatus, string> = {
  SIMULATED_PAID: '模拟已付款（不发生真实资金交易）。',
  SIMULATED_REFUNDED: '模拟已退款（不发生真实资金交易）。',
};

export interface ParsedShanghaiTime {
  month: number;
  day: number;
  time: string;
}

export interface TimelineStepView {
  name: string;
  reached: boolean;
  current: boolean;
}

export interface OrderItemView {
  name: string;
  quantity: number;
  unitPriceText: string;
  subtotalText: string;
}

export interface OrderStatusView {
  status: OrderStatus;
  statusLabel: string;
  activeIndex: number;
  steps: TimelineStepView[];
  orderId: string;
  items: OrderItemView[];
  totalText: string;
  slotRangeText: string;
  diningMode: DiningMode;
  diningModeText: string;
  createdText: string;
  updatedText: string;
  pickedUpText: string;
  cancelText: string;
  delayText: string;
  pickupCodeText: string;
  pickupCodeNotice: string;
  demoLabel: string;
  paymentText: string;
  cancelRuleText: string;
  changeDiningRuleText: string;
  version: number;
}

function parseShanghai(iso: string | null | undefined): ParsedShanghaiTime | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(typeof iso === 'string' ? iso : '');
  if (!matched) {
    return null;
  }
  return { month: Number(matched[2]), day: Number(matched[3]), time: `${matched[4]}:${matched[5]}` };
}

function slotRangeText(order: StudentOrder): string {
  const start = parseShanghai(order.slotStart);
  const end = parseShanghai(order.slotEnd);
  if (!start || !end) {
    return '';
  }
  return `${start.month}月${start.day}日 ${start.time}—${end.time}`;
}

function pickupCodeView(
  order: StudentOrder,
  mode: StudentMode,
): { pickupCodeText: string; pickupCodeNotice: string } {
  if (order.status === 'CANCELLED') {
    return { pickupCodeText: '订单已取消，无取餐码', pickupCodeNotice: '' };
  }
  if (order.status === 'COMPLETED') {
    return { pickupCodeText: '已取餐，无取餐码', pickupCodeNotice: '' };
  }
  if (order.status === 'READY' && typeof order.pickupCode === 'string' && order.pickupCode !== '') {
    return {
      pickupCodeText: order.pickupCode,
      pickupCodeNotice:
        mode === 'real' ? '请向档口出示取餐码' : '演示取餐码，不可用于真实核销',
    };
  }
  return { pickupCodeText: '可取餐后显示', pickupCodeNotice: '' };
}

function demoLabelOf(order: StudentOrder, mode: StudentMode): string {
  if (mode === 'real' || order.demo !== true) {
    return '';
  }
  return order.local === true ? '本机演示订单 · 档口端未登记' : '演示订单 · 与档口同单';
}

export interface OrderStatusViewOptions {
  mode?: StudentMode;
}

export function toOrderStatusView(
  order: StudentOrder,
  { mode = 'sample' }: OrderStatusViewOptions = {},
): OrderStatusView {
  const statusView = STATUS_VIEW[order.status] ?? { label: '状态未知', activeIndex: -1 };
  const cancelled = order.status === 'CANCELLED';
  const activeIndex = statusView.activeIndex;

  const steps: TimelineStepView[] = STEPS.map((name, index) => ({
    name,
    reached: !cancelled && index <= activeIndex,
    current: !cancelled && index === activeIndex,
  }));

  const createdAt = parseShanghai(order.createdAt);
  const updatedAt = parseShanghai(order.updatedAt);
  const pickedUp = parseShanghai(order.pickedUpAt);
  const expectedReadyAt = parseShanghai(order.delay?.expectedReadyAt);
  const delay =
    order.delay && typeof order.delay === 'object'
      ? `档口告知延迟：${order.delay.reason ?? '未说明原因'}，预计 ${expectedReadyAt?.time ?? '待定'}`
      : '';

  return {
    status: order.status,
    statusLabel: statusView.label,
    activeIndex,
    steps,
    orderId: order.id,
    items: (order.items ?? []).map((item: OrderItem) => ({
      name: item.name,
      quantity: item.quantity,
      unitPriceText: formatYuan(item.unitPriceFen),
      subtotalText: formatYuan(item.unitPriceFen * item.quantity),
    })),
    totalText: formatYuan(order.totalFen),
    slotRangeText: slotRangeText(order),
    diningMode: order.diningMode,
    diningModeText: DINING_MODE_TEXT[order.diningMode] ?? '',
    createdText: createdAt ? `${createdAt.month}月${createdAt.day}日 ${createdAt.time}` : '',
    updatedText: updatedAt ? `${updatedAt.month}月${updatedAt.day}日 ${updatedAt.time}` : '',
    pickedUpText: pickedUp ? `取餐时间：${pickedUp.month}月${pickedUp.day}日 ${pickedUp.time}` : '',
    cancelText: cancelled ? `已取消：${order.cancellationReason ?? '未提供原因'}` : '',
    delayText: delay,
    ...pickupCodeView(order, mode),
    demoLabel: demoLabelOf(order, mode),
    paymentText: PAYMENT_TEXT[order.paymentStatus] ?? PAYMENT_TEXT.SIMULATED_PAID,
    cancelRuleText: CANCEL_RULE_TEXT,
    changeDiningRuleText: CHANGE_DINING_RULE_TEXT,
    version: order.version,
  };
}