import type { ShopAuthReason } from '../utils/shopAuthView';

export type LoginGuideScope = 'shop' | 'orders' | 'detail';

export interface LoginGuideContent {
  title: string;
  description: string;
}

export const RECHECK_STILL_SIGNED_OUT_NOTICE = '仍未完成登录，请先在公共入口完成登录。';

const RESOURCE: Record<LoginGuideScope, string> = {
  shop: '学生店铺列表',
  orders: '订单列表',
  detail: '订单详情',
};

const TITLES: Record<ShopAuthReason, string> = {
  unauthenticated: '需要登录后才能继续',
  'session-expired': '登录已过期，请重新登录',
  forbidden: '当前身份无法查看该内容',
};

function descriptionOf(reason: ShopAuthReason, scope: LoginGuideScope): string {
  const resource = RESOURCE[scope];
  if (reason === 'unauthenticated') {
    return `登录入口在公共自检页，完成登录后才能读取${resource}。`;
  }
  if (reason === 'session-expired') {
    return `登录已过期，请到公共入口重新登录后再读取${resource}。`;
  }
  if (scope === 'shop') {
    return '当前登录不是学生身份，无法查看学生店铺列表，请重新登录学生演示账号。';
  }
  return `当前身份无法查看${resource}，请重新登录学生演示账号。`;
}

export function loginGuideContent({
  reason,
  scope = 'detail',
}: {
  reason: ShopAuthReason;
  scope?: LoginGuideScope;
}): LoginGuideContent {
  const safeReason: ShopAuthReason =
    reason === 'unauthenticated' || reason === 'session-expired' || reason === 'forbidden'
      ? reason
      : 'unauthenticated';
  return {
    title: TITLES[safeReason],
    description: descriptionOf(safeReason, scope),
  };
}