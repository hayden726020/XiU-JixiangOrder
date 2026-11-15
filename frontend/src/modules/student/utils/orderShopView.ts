import type { StudentMode, StudentOrder } from '../types';
import {
  ORDER_SHOP_DEMO_NOTE,
  ORDER_SHOP_FIELD_PENDING,
  ORDER_SHOP_NAME_MISSING,
  ORDER_SHOP_SAMPLE_MISSING,
  ORDER_SHOP_SERVER_MISSING,
} from './shopTexts';

export type OrderShopKind = 'demo-name' | 'server-name' | 'server-id-only' | 'missing';

export interface OrderShopView {
  kind: OrderShopKind;
  text: string;
  note: string;
  showRow: boolean;
}

export function toOrderShopView(order: StudentOrder, mode: StudentMode): OrderShopView {
  const name = typeof order.merchantName === 'string' ? order.merchantName.trim() : '';
  const merchantId = typeof order.merchantId === 'string' ? order.merchantId.trim() : '';

  if (mode === 'sample') {
    if (name !== '') {
      return { kind: 'demo-name', text: name, note: ORDER_SHOP_DEMO_NOTE, showRow: true };
    }
    return { kind: 'missing', text: ORDER_SHOP_SAMPLE_MISSING, note: '', showRow: false };
  }

  if (name !== '') {
    return { kind: 'server-name', text: name, note: '', showRow: true };
  }
  if (merchantId !== '') {
    return {
      kind: 'server-id-only',
      text: merchantId,
      note: ORDER_SHOP_NAME_MISSING,
      showRow: true,
    };
  }
  return {
    kind: 'missing',
    text: ORDER_SHOP_SERVER_MISSING,
    note: ORDER_SHOP_FIELD_PENDING,
    showRow: false,
  };
}