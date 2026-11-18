import type { CancelRequestStatus } from '../types';

export const CANCEL_RULES = [
  '未接单（待接单）可直接取消，取消后为模拟退款。',
  '已接单、制作中、可取餐需提交取消申请，由档口处理；申请待处理不代表已取消。',
  '档口处理与解除时段占用由服务端规则决定。',
];

export const CANCEL_CONFIRM_TEXT =
  '取消后订单将结束，并显示模拟退款结果；不会发生真实资金交易。';

export const CANCEL_REASON_LABEL = '取消理由';

export const CANCEL_REASON_PLACEHOLDER = '请填写取消理由（1—200 字）';

export const CANCEL_APPLY_NOTE =
  '提交后由档口处理；申请待处理不代表已取消，可取餐时仍会显示取餐码。';

export const CANCEL_PENDING_TEXT = '取消申请待处理，不代表已取消。';

export const CANCEL_READY_PENDING_TEXT =
  '取消申请待处理，不代表已取消；当前仍可取餐，取餐码继续显示。';

export const CANCEL_APPROVED_TEXT =
  '档口已批准取消，模拟退款结果以服务端返回为准。';

export const CANCEL_REJECTED_TEXT = '档口未通过取消申请，订单继续处理。';

export const CANCEL_DECISION_MISSING = '档口未填写理由';

export const CANCEL_SAMPLE_TEXT = '样例模式不提供真实取消；仅展示规则与结果。';

export const CANCEL_INVALID_TEXT = '订单状态与取消申请不一致，暂不提供操作。';

export function cancelBadgeOf(status: CancelRequestStatus): string {
  if (status === 'PENDING') {
    return '取消申请处理中';
  }
  if (status === 'REJECTED') {
    return '取消申请未通过';
  }
  return '';
}

export function isCancelAuthCode(code: string): boolean {
  return code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED';
}

export function isCancelForbiddenCode(code: string): boolean {
  return code === 'FORBIDDEN';
}

export function isCancelConflictCode(code: string): boolean {
  return (
    code === 'ORDER_VERSION_CONFLICT' ||
    code === 'INVALID_ORDER_STATE' ||
    code === 'ALREADY_CANCELLED'
  );
}

export function isCancelRetryableCode(code: string): boolean {
  return code === 'SERVICE_UNAVAILABLE' || code === 'TIMEOUT' || code === 'NETWORK_ERROR';
}

export function cancelErrorText(code: string): string {
  if (code === 'VALIDATION_ERROR') {
    return '取消内容不完整，请检查理由后重试。';
  }
  if (code === 'UNAUTHENTICATED') {
    return '请先在公共入口完成登录，再取消订单。';
  }
  if (code === 'SESSION_EXPIRED') {
    return '登录已过期，请重新登录后重试。';
  }
  if (code === 'FORBIDDEN') {
    return '当前身份无法取消该订单，请使用学生演示账号。';
  }
  if (code === 'ORDER_NOT_FOUND') {
    return '订单不存在或对当前身份不可见。';
  }
  if (code === 'ORDER_VERSION_CONFLICT') {
    return '订单状态已变化，已重新读取；请核对后再操作。';
  }
  if (code === 'INVALID_ORDER_STATE') {
    return '当前订单状态不支持该操作。';
  }
  if (code === 'ALREADY_CANCELLED') {
    return '订单已取消，无需重复操作。';
  }
  if (code === 'REQUEST_CONFLICT') {
    return '本次请求与此前内容不一致，请重新发起。';
  }
  if (
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'TIMEOUT' ||
    code === 'NETWORK_ERROR'
  ) {
    return '操作结果待确认，请重试；重试不会重复退款。';
  }
  if (code === 'INVALID_RESPONSE') {
    return '服务端返回异常，未更新订单状态。';
  }
  if (code === 'SAMPLE_MODE_ONLY') {
    return '样例模式不提供真实取消。';
  }
  return '取消未完成，请稍后重试。';
}