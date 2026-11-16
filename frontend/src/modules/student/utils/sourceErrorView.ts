import { isApiError } from '../types';
import { SHOP_LIST_UNAVAILABLE_ERROR } from './shopTexts';

const MESSAGES: Record<string, string> = {
  API_BASE_NOT_CONFIGURED: '尚未配置公共服务地址，请在公共入口设置服务地址。',
  NETWORK_ERROR: '无法连接服务，请确认服务已启动、地址可达。',
  NETWORK_TIMEOUT: '读取超时，请稍后重新读取。',
  INVALID_RESPONSE: '服务返回的数据格式不符合约定，请稍后重试或联系维护者。',
  UNAUTHENTICATED: '请先在公共入口完成演示登录。',
  SESSION_EXPIRED: '登录状态已过期，请先在公共入口重新登录。',
  SERVICE_UNAVAILABLE: '服务暂不可用，请稍后重新读取。',
  SLOT_NOT_FOUND: '该时段不存在或已下线，请重新选择。',
  VALIDATION_ERROR: '请求参数不符合约定，请返回上一步重新选择。',
  SHOP_LIST_UNAVAILABLE: SHOP_LIST_UNAVAILABLE_ERROR,
};

export function toSourceErrorView(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'INVALID_RESPONSE' && error.message.includes('店铺')) {
      return error.message;
    }
    const known = MESSAGES[error.code];
    if (known) {
      return known;
    }
    const message = error.message.trim();
    return message.length > 0 ? message : '读取失败，请重试。';
  }
  return '读取失败，请重试。';
}