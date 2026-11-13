import type { DiningMode, Order, OrderStatus } from '../types';

export const orderStatusText: Record<OrderStatus, string> = {
  NEW: '待接单',
  ACCEPTED: '已接单',
  PREPARING: '制作中',
  READY: '可取餐',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export const diningModeText: Record<DiningMode, string> = {
  DINE_IN: '堂食',
  TAKEAWAY: '外带',
};

export function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

export function formatFen(fen: number): string {
  return `${(fen / 100).toFixed(2)} 元`;
}

export function formatDateTime(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

export function itemQuantity(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function exceptionText(order: Order): string | null {
  const marks: string[] = [];
  if (order.cancelRequest.status === 'PENDING') {
    marks.push('待处理取消申请');
  }
  if (order.delay) {
    marks.push('已设置延迟');
  }
  return marks.length > 0 ? marks.join(' · ') : null;
}