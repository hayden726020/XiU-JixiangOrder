import type { SourceError } from '../types';
import {
  BACK_TO_MENU_LABEL,
  BACK_TO_SLOT_LABEL,
  DISH_SHORTAGE_SUBMIT,
  SLOT_CLOSED_MESSAGE,
  SLOT_UNAVAILABLE_MESSAGE,
  dishShortageWithNames,
} from './submitTexts';

export type SubmitErrorAction = 'back-to-slot' | 'back-to-menu' | 'retry';

export interface SubmitErrorView {
  code: string;
  message: string;
  action: SubmitErrorAction;
  actionLabel: string;
}

const ERROR_RULES: Record<string, { message: string; action: SubmitErrorAction }> = {
  SLOT_FULL: { message: SLOT_UNAVAILABLE_MESSAGE, action: 'back-to-slot' },
  SLOT_CLOSED: { message: SLOT_CLOSED_MESSAGE, action: 'back-to-slot' },
  OUT_OF_STOCK: { message: DISH_SHORTAGE_SUBMIT, action: 'back-to-menu' },
  SERVICE_UNAVAILABLE: { message: '服务暂不可用，请稍后查询或重试原请求。', action: 'retry' },
  REQUEST_CONFLICT: { message: '请求内容已变化，请重新确认。', action: 'retry' },
  TIMEOUT: {
    message: '网络超时，订单可能已创建。请先查询结果，不要重复下单。',
    action: 'retry',
  },
};

const ACTION_LABELS: Record<SubmitErrorAction, string> = {
  'back-to-slot': BACK_TO_SLOT_LABEL,
  'back-to-menu': BACK_TO_MENU_LABEL,
  retry: '重试同一请求',
};

const FALLBACK_MESSAGE = '提交失败，请稍后重试。';
const NON_ACTIONABLE_MESSAGE = new RegExp(
  [['调整', '数量'].join(''), ['名', '额'].join(''), ['重新', '下单'].join('')].join('|'),
);

function fallbackMessage(message: string): string {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (trimmed === '' || NON_ACTIONABLE_MESSAGE.test(trimmed)) {
    return FALLBACK_MESSAGE;
  }
  return trimmed;
}

export function toSubmitErrorView(error: SourceError | null): SubmitErrorView | null {
  if (!error) {
    return null;
  }
  const rule = ERROR_RULES[error.code];
  const action = rule?.action ?? 'retry';
  const dishNames = Array.isArray(error.dishNames) ? error.dishNames : [];
  const shortageMessage =
    error.code === 'OUT_OF_STOCK' && dishNames.length > 0
      ? dishShortageWithNames(dishNames)
      : null;
  return {
    code: error.code,
    message: rule?.message ? shortageMessage ?? rule.message : fallbackMessage(error.message),
    action,
    actionLabel: ACTION_LABELS[action],
  };
}