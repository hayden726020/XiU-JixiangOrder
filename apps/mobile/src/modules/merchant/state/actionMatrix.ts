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

export interface ActionInput {
  pickupCode?: string;
  reason?: string;
}

const ORDER_PATH = '/merchant/orders/{id}';

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

export function actionRequestName(action: OrderAction): string {
  return action.path.split('/').at(-1) ?? action.path;
}

const REAL_WRITE_CODES = new Set(['ACCEPT', 'START_PREPARING', 'MARK_READY', 'VERIFY']);

export function isRealWriteAction(action: OrderAction): boolean {
  return REAL_WRITE_CODES.has(action.code);
}

export function actionErrorText(code: string, message: string, action: OrderAction): string {
  switch (code) {
    case 'ORDER_VERSION_CONFLICT':
      return '订单已被其他操作更新，正在刷新最新状态；请确认后重新点击。';
    case 'INVALID_ORDER_STATE':
      return `当前订单状态不允许「${action.label}」，正在刷新最新状态。`;
    case 'PICKUP_CODE_INVALID':
      return '取餐码不正确，请核对学生出示的码后重试。';
    case 'PICKUP_CODE_USED':
      return '该订单已取餐，请勿重复核销；页面正在刷新。';
    case 'REQUEST_CONFLICT':
      return '本次请求与之前的内容不一致，已准备新的请求号，请重新点击。';
    case 'UNAUTHENTICATED':
    case 'SESSION_EXPIRED':
      return '登录已失效，请重新登录档口演示账号后重试。';
    case 'NETWORK_TIMEOUT':
      return '请求超时，结果待确认；重试会复用同一请求号，避免重复推进。';
    case 'API_BASE_NOT_CONFIGURED':
      return '尚未配置服务地址，请到 #/system-check 配置后再试。';
    default:
      return message;
  }
}

export function validateActionInput(
  action: OrderAction,
  input: ActionInput = {},
  mode: 'sample' | 'real' = 'sample',
): string | null {
  if (action.needsPickupCode && !(input.pickupCode ?? '').trim()) {
    return mode === 'real'
      ? '请先输入学生出示的取餐码。'
      : '请先输入学生出示的取餐码；样例模式不会核销成功。';
  }
  if (action.code === 'APPROVE_CANCEL' || action.code === 'REJECT_CANCEL') {
    if (!(input.reason ?? '').trim()) {
      return mode === 'real'
        ? `${action.label}必须填写理由。`
        : `${action.label}必须填写理由；样例模式不会产生真实变更。`;
    }
  }
  return null;
}

export function actionPrompt(
  action: OrderAction,
  orderId: string,
  mode: 'sample' | 'real' = 'sample',
  input: ActionInput = {},
): string {
  const path = actionPath(action, orderId);
  const fields: string[] = [];
  if (action.action) {
    const key = action.code === 'APPROVE_CANCEL' || action.code === 'REJECT_CANCEL'
      ? 'decision'
      : 'action';
    fields.push(`${key}=${action.action}`);
  }
  if (action.needsPickupCode) {
    const code = input.pickupCode?.trim();
    fields.push(
      mode === 'sample' && code
        ? `pickupCode=${code}`
        : 'pickupCode=学生出示的取餐码',
    );
  }
  if (action.needsReason) {
    const reason = input.reason?.trim();
    fields.push(reason ? `reason=${reason}` : 'reason=处理理由');
  }
  if (action.needsExpectedReadyAt) fields.push('expectedReadyAt=带时区的 ISO 时间');
  if (action.needsDiningMode) fields.push('diningMode=DINE_IN 或 TAKEAWAY');
  const fieldText = fields.length > 0 ? `（${fields.join('，')}）` : '';
  if (mode === 'real') {
    return `真实模式：该写操作尚未接入，这里将调用 ${action.method} ${path}${fieldText}，当前不产生真实变更。`;
  }
  return `样例模式：这里将调用 ${action.method} ${path}${fieldText}，当前不产生真实变更。`;
}