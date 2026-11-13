import { sampleMenu, sampleOrders, sampleSlots } from './sampleData';
import type { MenuDay, MerchantOrder, MerchantScenario, MerchantSource, SlotDay, SourceResult } from './types';

function fail<T>(code: string, message: string): SourceResult<T> {
  return { ok: false, error: { code, message, retryable: code === 'SERVICE_UNAVAILABLE' } };
}

export function createMerchantSource(options: {
  mode?: 'sample' | 'real';
  scenario?: MerchantScenario;
} = {}): MerchantSource {
  const mode = options.mode ?? 'sample';
  const scenario = options.scenario ?? 'normal';

  if (mode !== 'sample') {
    const unavailable = <T,>() => fail<T>(
      'SERVICE_UNAVAILABLE',
      '真实数据源尚未接入：等待 spcuteag 提供公共请求封装与服务地址。',
    );
    return {
      mode: 'real',
      scenario,
      getOrders: unavailable,
      getOrder: unavailable,
      getMenu: unavailable,
      getSlots: unavailable,
    };
  }

  const orders = sampleOrders(scenario);

  return {
    mode: 'sample',
    scenario,
    getOrders: (): SourceResult<MerchantOrder[]> => ({ ok: true, data: structuredClone(orders) }),
    getOrder: (id: string): SourceResult<MerchantOrder> => {
      const found = orders.find((order) => order.id === id);
      if (!found) return fail('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。');
      return { ok: true, data: structuredClone(found) };
    },
    getMenu: (date: string): SourceResult<MenuDay> => {
      const menu = sampleMenu(date);
      if (!menu) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: menu };
    },
    getSlots: (date: string): SourceResult<SlotDay> => {
      const slots = sampleSlots(date);
      if (!slots) return fail('VALIDATION_ERROR', `只支持样例日期：${date}`);
      return { ok: true, data: slots };
    },
  };
}