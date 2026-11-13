import type { MerchantOrder, OrderStatus } from '../data/types';

export interface OrderAction {
  code: string;
  label: string;
  kind: 'primary' | 'secondary' | 'danger';
  method: 'POST' | 'PATCH';
  path: string;
  action?: string;
  needsReason?: boolean;
  needsPickupCode?: boolean;
  needsExpectedReadyAt?: boolean;
  needsDiningMode?: boolean;
}

const ORDER_PATH = '/api/v1/merchant/orders/{id}';

const ACTIONS: Record<string, OrderAction> = {
  ACCEPT: {
    code: 'ACCEPT',
    label: '接单',
    kind: 'primary',
    method: 'POST',
    path: `${ORDER_PATH}/advance`,
    action: 'ACCEPT',
  },
  START_PREPARING: {
    code: 'START_PREPARING',
    label: '开始制作',
    kind: 'primary',
    method: 'POST',
    path: `${ORDER_PATH}/advance`,
    action: 'START_PREPARING',
  },
  MARK_READY: {
    code: 'MARK_READY',
    label: '标记可取',
    kind: 'primary',
    method: 'POST',
    path: `${ORDER_PATH}/advance`,
    action: 'MARK_READY',
  },
  VERIFY: {
    code: 'VERIFY',
    label: '核销取餐',
    kind: 'primary',
    method: 'POST',
    path: `${ORDER_PATH}/verify`,
    needsPickupCode: true,
  },
  SET_DELAY: {
    code: 'SET_DELAY',
    label: '填写延迟',
    kind: 'secondary',
    method: 'POST',
    path: `${ORDER_PATH}/delay`,
    needsReason: true,
    needsExpectedReadyAt: true,
  },
  CANCEL_ORDER: {
    code: 'CANCEL_ORDER',
    label: '缺货取消',
    kind: 'danger',
    method: 'POST',
    path: `${ORDER_PATH}/cancel`,
    needsReason: true,
  },
  APPROVE_CANCEL: {
    code: 'APPROVE_CANCEL',
    label: '批准取消',
    kind: 'danger',
    method: 'POST',
    path: `${ORDER_PATH}/cancel-decision`,
    action: 'APPROVE',
    needsReason: true,
  },
  REJECT_CANCEL: {
    code: 'REJECT_CANCEL',
    label: '拒绝取消',
    kind: 'secondary',
    method: 'POST',
    path: `${ORDER_PATH}/cancel-decision`,
    action: 'REJECT',
    needsReason: true,
  },
  CHANGE_DINING_MODE: {
    code: 'CHANGE_DINING_MODE',
    label: '变更用餐方式',
    kind: 'secondary',
    method: 'PATCH',
    path: `${ORDER_PATH}/dining-mode`,
    needsReason: true,
    needsDiningMode: true,
  },
};

const CODES_BY_STATUS: Record<OrderStatus, string[]> = {
  NEW: ['ACCEPT', 'CANCEL_ORDER', 'CHANGE_DINING_MODE'],
  ACCEPTED: ['START_PREPARING', 'SET_DELAY', 'CANCEL_ORDER', 'CHANGE_DINING_MODE'],
  PREPARING: ['MARK_READY', 'SET_DELAY', 'CANCEL_ORDER', 'CHANGE_DINING_MODE'],
  READY: ['VERIFY', 'SET_DELAY', 'CANCEL_ORDER', 'CHANGE_DINING_MODE'],
  COMPLETED: [],
  CANCELLED: [],
};

export function getOrderActions(order: MerchantOrder): OrderAction[] {
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    return [];
  }
  const codes = [...CODES_BY_STATUS[order.status]];
  if (order.cancelRequest.status === 'PENDING') {
    codes.push('APPROVE_CANCEL', 'REJECT_CANCEL');
  }
  return codes.map((code) => structuredClone(ACTIONS[code]));
}

export function getPrimaryAction(order: MerchantOrder): OrderAction | null {
  return getOrderActions(order).find((action) => action.kind === 'primary') ?? null;
}

export function actionPath(action: OrderAction, orderId: string): string {
  return action.path.replace('{id}', orderId);
}

export function actionPrompt(
  action: OrderAction,
  orderId: string,
  mode: 'sample' | 'real' = 'sample',
): string {
  const path = actionPath(action, orderId);
  const fields: string[] = [];
  if (action.action) fields.push(`action=${action.action}`);
  if (action.needsPickupCode) fields.push('pickupCode=学生出示的取餐码');
  if (action.needsReason) fields.push('reason=处理理由');
  if (action.needsExpectedReadyAt) fields.push('expectedReadyAt=带时区的 ISO 时间');
  if (action.needsDiningMode) fields.push('diningMode=DINE_IN 或 TAKEAWAY');
  const fieldText = fields.length > 0 ? `（${fields.join('，')}）` : '';
  if (mode === 'real') {
    return `真实模式：写操作尚未接入，这里将调用 ${action.method} ${path}${fieldText}，当前不产生真实变更。`;
  }
  return `样例模式：这里将调用 ${action.method} ${path}${fieldText}，当前不产生真实变更。`;
}