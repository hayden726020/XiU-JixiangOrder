import type { SourceError } from '../types';

export type SubmitErrorAction = 'back-to-slot' | 'back-to-menu' | 'retry';

export interface SubmitErrorView {
  code: string;
  message: string;
  action: SubmitErrorAction;
  actionLabel: string;
}

const ERROR_RULES: Record<string, { message: string; action: SubmitErrorAction }> = {
  SLOT_FULL: { message: '该时段名额已满，请选择其他时段。', action: 'back-to-slot' },
  OUT_OF_STOCK: { message: '所选菜品数量不足，请调整数量。', action: 'back-to-menu' },
  SERVICE_UNAVAILABLE: { message: '服务暂不可用，请稍后查询或重试原请求。', action: 'retry' },
  REQUEST_CONFLICT: { message: '请求内容已变化，请重新确认。', action: 'retry' },
  TIMEOUT: {
    message: '网络超时，订单可能已创建。请先查询结果，不要重复下单。',
    action: 'retry',
  },
};

const ACTION_LABELS: Record<SubmitErrorAction, string> = {
  'back-to-slot': '返回时段页',
  'back-to-menu': '返回菜单调整数量',
  retry: '重试同一请求',
};

export function toSubmitErrorView(error: SourceError | null): SubmitErrorView | null {
  if (!error) {
    return null;
  }
  const rule = ERROR_RULES[error.code];
  const action = rule?.action ?? 'retry';
  return {
    code: error.code,
    message: rule?.message ?? error.message ?? '提交失败，请稍后重试。',
    action,
    actionLabel: ACTION_LABELS[action],
  };
}