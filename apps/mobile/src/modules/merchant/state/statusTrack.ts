import type { MerchantOrder, OrderStatus } from '../data/types';

export interface StatusTrackStepMeta {
  status: OrderStatus;
  label: string;
}

export const STATUS_TRACK: OrderStatus[] = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
];

const TRACK_META: StatusTrackStepMeta[] = [
  { status: 'NEW', label: '待接单' },
  { status: 'ACCEPTED', label: '已接单' },
  { status: 'PREPARING', label: '制作中' },
  { status: 'READY', label: '可取餐' },
  { status: 'COMPLETED', label: '已完成' },
];

export type StatusStepState = 'done' | 'current' | 'upcoming';
export type PendingTone = 'pending' | 'cleared' | 'idle';

export interface StatusTrackStep extends StatusTrackStepMeta {
  state: StatusStepState;
}

export interface StatusTrackView {
  steps: StatusTrackStep[];
  pendingTone: PendingTone;
  pendingLabel: string;
  pendingDetail: string;
  active: boolean;
  cancelled: boolean;
  note: string;
}

function statusLabel(status: OrderStatus): string {
  return TRACK_META.find((step) => step.status === status)?.label
    ?? (status === 'CANCELLED' ? '已取消' : status);
}

/**
 * 状态轴只表达订单主流程；「待处理」是退款/换餐申请分支，不占主流程位置。
 * 有申请时主状态保持不动，由待处理分支提示先处理申请。
 */
export function buildStatusTrack(order: MerchantOrder): StatusTrackView {
  const currentIndex = STATUS_TRACK.indexOf(order.status);
  const steps: StatusTrackStep[] = TRACK_META.map((step, index) => ({
    ...step,
    state: currentIndex < 0
      ? 'upcoming'
      : index < currentIndex
        ? 'done'
        : index === currentIndex ? 'current' : 'upcoming',
  }));

  const cancelStatus = order.cancelRequest?.status ?? 'NONE';
  const changeStatus = order.diningModeChange?.status ?? 'NONE';
  const pendingCancel = cancelStatus === 'PENDING';
  const pendingChange = changeStatus === 'PENDING';
  const active = pendingCancel || pendingChange;
  const cleared = !active
    && [cancelStatus, changeStatus].some((status) => status === 'APPROVED' || status === 'REJECTED');

  const pendingTone: PendingTone = active ? 'pending' : cleared ? 'cleared' : 'idle';
  const pendingDetail = active
    ? (pendingCancel && pendingChange
      ? '退款与用餐方式申请待处理'
      : pendingCancel ? '退款申请待处理' : '用餐方式变更申请待处理')
    : cleared ? '申请已处理' : '无待处理申请';

  const cancelled = order.status === 'CANCELLED';

  const note = cancelled
    ? '订单已取消，主流程终止；取消原因与完整订单记录保留在下方。'
    : active
      ? `${pendingDetail}；先处理待处理事项，当前订单主状态仍为「${statusLabel(order.status)}」，处理后继续按上方状态轴操作。`
      : cleared
        ? '申请已处理，订单继续按上方主流程显示。'
        : '有退款或用餐方式变更申请时，订单会进入「待处理」；它不会改变上方主流程的当前状态。';

  return {
    steps,
    pendingTone,
    pendingLabel: '待处理',
    pendingDetail,
    active,
    cancelled,
    note,
  };
}