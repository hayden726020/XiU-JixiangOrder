import type { SourceError } from '../types';
import {
  BACK_TO_MENU_LABEL,
  BACK_TO_SLOT_LABEL,
  DISH_SHORTAGE_SUBMIT,
  SLOT_CLOSED_MESSAGE,
  SLOT_UNAVAILABLE_MESSAGE,
} from './submitTexts';

export type ErrorAction =
  | 'login'
  | 'reconfirm'
  | 'retry'
  | 'back-to-slot'
  | 'back-to-menu'
  | 'reload';

export interface ErrorSemantics {
  action: ErrorAction;
  message: string;
}

export const ACTION_LABELS: Record<ErrorAction, string> = {
  login: '去公共入口登录',
  reconfirm: '结束本次请求',
  retry: '重试同一请求',
  'back-to-slot': BACK_TO_SLOT_LABEL,
  'back-to-menu': BACK_TO_MENU_LABEL,
  reload: '重新读取',
};

const SUBMIT_RULES: Record<string, ErrorSemantics> = {
  UNAUTHENTICATED: { action: 'login', message: '请先在公共入口完成演示登录。' },
  SESSION_EXPIRED: { action: 'login', message: '登录已过期，请重新登录。' },
  FORBIDDEN: { action: 'login', message: '当前身份没有下单权限，请重新登录学生演示账号。' },
  SLOT_FULL: { action: 'back-to-slot', message: SLOT_UNAVAILABLE_MESSAGE },
  SLOT_CLOSED: { action: 'back-to-slot', message: SLOT_CLOSED_MESSAGE },
  SLOT_NOT_FOUND: { action: 'back-to-slot', message: '该时段不存在或已下线，请重新选择。' },
  OUT_OF_STOCK: { action: 'back-to-menu', message: DISH_SHORTAGE_SUBMIT },
  DISH_NOT_FOUND: { action: 'back-to-menu', message: '部分菜品已下架，请返回菜单重新选择。' },
  REQUEST_CONFLICT: {
    action: 'reconfirm',
    message: '请求内容与首次提交不一致，请结束本次请求后重新确认。',
  },
  SERVICE_UNAVAILABLE: {
    action: 'retry',
    message: '服务暂不可用，结果可能未确定，请稍后用同一请求重试。',
  },
  NETWORK_ERROR: {
    action: 'retry',
    message: '无法连接服务，请确认服务已启动后再重试同一请求。',
  },
  NETWORK_TIMEOUT: {
    action: 'retry',
    message: '网络超时，订单可能已创建。请先查询结果，不要重复下单。',
  },
  TIMEOUT: {
    action: 'retry',
    message: '网络超时，订单可能已创建。请先查询结果，不要重复下单。',
  },
  VALIDATION_ERROR: { action: 'back-to-menu', message: '提交信息不完整，请返回菜单核对。' },
  API_BASE_NOT_CONFIGURED: {
    action: 'retry',
    message: '尚未配置公共服务地址，请先在公共入口完成设置。',
  },
};

const DETAIL_RULES: Record<string, ErrorSemantics> = {
  UNAUTHENTICATED: { action: 'login', message: '请先在公共入口完成演示登录。' },
  SESSION_EXPIRED: { action: 'login', message: '登录已过期，请重新登录。' },
  FORBIDDEN: { action: 'login', message: '当前身份无法查看该订单，请重新登录学生演示账号。' },
  ORDER_NOT_FOUND: { action: 'back-to-menu', message: '订单不存在或对当前身份不可见。' },
  SERVICE_UNAVAILABLE: { action: 'reload', message: '服务暂不可用，请稍后重新读取。' },
  NETWORK_ERROR: { action: 'reload', message: '无法连接服务，请确认服务已启动后重新读取。' },
  NETWORK_TIMEOUT: { action: 'reload', message: '读取超时，请稍后重新读取。' },
  TIMEOUT: { action: 'reload', message: '读取超时，请稍后重新读取。' },
  INVALID_RESPONSE: { action: 'reload', message: '服务返回的数据格式不符合约定，请稍后重试。' },
};

const LIST_RULES: Record<string, ErrorSemantics> = {
  UNAUTHENTICATED: { action: 'login', message: '请先在公共入口完成演示登录。' },
  SESSION_EXPIRED: { action: 'login', message: '登录已过期，请重新登录。' },
  FORBIDDEN: {
    action: 'login',
    message: '当前身份无法查看学生订单，请重新登录学生演示账号。',
  },
  SERVICE_UNAVAILABLE: { action: 'reload', message: '服务暂不可用，请稍后重新读取。' },
  NETWORK_ERROR: { action: 'reload', message: '无法连接服务，请确认服务已启动后重新读取。' },
  NETWORK_TIMEOUT: { action: 'reload', message: '读取超时，请稍后重新读取。' },
  TIMEOUT: { action: 'reload', message: '读取超时，请稍后重新读取。' },
  INVALID_RESPONSE: {
    action: 'reload',
    message: '服务返回的数据格式不符合约定，请稍后重试。',
  },
  VALIDATION_ERROR: {
    action: 'reload',
    message: '服务返回的数据格式不符合约定，请稍后重试。',
  },
  API_BASE_NOT_CONFIGURED: {
    action: 'reload',
    message: '尚未配置公共服务地址，请先在公共入口完成设置。',
  },
};

const RAW_CODE_PATTERN = /\b[A-Z][A-Z0-9_]{3,}\b/;
const FALLBACK_MESSAGE = '提交失败，请稍后重试。';
const FALLBACK_DETAIL_MESSAGE = '订单信息读取失败，请重试。';
const FALLBACK_LIST_MESSAGE = '订单列表读取失败，请稍后重新读取。';
const NON_ACTIONABLE_MESSAGE = new RegExp(
  [['调整', '数量'].join(''), ['名', '额'].join(''), ['重新', '下单'].join('')].join('|'),
);

export function sanitizeMessage(message: unknown, fallback: string): string {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (trimmed === '' || RAW_CODE_PATTERN.test(trimmed) || NON_ACTIONABLE_MESSAGE.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function resolveSubmitSemantics(error: SourceError): ErrorSemantics {
  const rule = SUBMIT_RULES[error.code];
  if (rule) {
    return rule;
  }
  return { action: 'retry', message: sanitizeMessage(error.message, FALLBACK_MESSAGE) };
}

export function resolveDetailSemantics(error: SourceError): ErrorSemantics {
  const rule = DETAIL_RULES[error.code];
  if (rule) {
    return rule;
  }
  return { action: 'reload', message: sanitizeMessage(error.message, FALLBACK_DETAIL_MESSAGE) };
}
export function resolveListSemantics(error: SourceError): ErrorSemantics {
  const rule = LIST_RULES[error.code];
  if (rule) {
    return rule;
  }
  return { action: 'reload', message: sanitizeMessage(error.message, FALLBACK_LIST_MESSAGE) };
}