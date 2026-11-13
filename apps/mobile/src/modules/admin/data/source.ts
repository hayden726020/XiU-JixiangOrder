import type { AdminSettings, Order } from '../types';
import { sampleOrders, sampleSettings } from './sample';

export type AdminSourceMode = 'sample' | 'live';

export interface AdminSource {
  mode: AdminSourceMode;
  listOrders(): Order[];
  getSettings(): AdminSettings;
}

export function createAdminSource(options: { mode: AdminSourceMode }): AdminSource {
  if (options.mode === 'live') {
    return {
      mode: 'live',
      listOrders: () => {
        throw new Error('真实订单查询接口尚未接入（DRAFT v0.2，管理端字段待补）');
      },
      getSettings: () => {
        throw new Error('真实配置接口尚未接入（DRAFT v0.2，管理端字段待补）');
      },
    };
  }

  return {
    mode: 'sample',
    listOrders: () => sampleOrders,
    getSettings: () => sampleSettings,
  };
}