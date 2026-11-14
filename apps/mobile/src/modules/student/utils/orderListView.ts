import type { SourceError, StudentMode, StudentOrder } from '../types';
import { ACTION_LABELS, resolveListSemantics } from './errorSemantics';
import { toOrderStatusView } from './orderStatusView';

export interface OrderListDishLine {
  name: string;
  quantity: number;
}

export interface OrderListCardView {
  id: string;
  statusLabel: string;
  totalText: string;
  diningModeText: string;
  slotRangeText: string;
  createdText: string;
  dishLines: OrderListDishLine[];
  dishSummary: string;
  cancelled: boolean;
}

export interface OrderListView {
  cards: OrderListCardView[];
  emptyText: string;
  countText: string;
}

export type OrderListErrorAction = 'login' | 'reload';

export interface OrderListErrorView {
  code: string;
  message: string;
  action: OrderListErrorAction;
  actionLabel: string;
}

const EMPTY_TEXT = '暂无订单。还没有订单，返回菜单去点餐吧。';
const MAX_DISH_LINES = 2;

export function deriveOrderListView(orders: StudentOrder[], mode: StudentMode): OrderListView {
  const cards = orders.map((order): OrderListCardView => {
    const view = toOrderStatusView(order, { mode });
    const dishLines = (order.items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
    }));
    const shown = dishLines
      .slice(0, MAX_DISH_LINES)
      .map((line) => `${line.name} × ${line.quantity}`)
      .join('、');
    return {
      id: view.orderId,
      statusLabel: view.statusLabel,
      totalText: view.totalText,
      diningModeText: view.diningModeText,
      slotRangeText: view.slotRangeText,
      createdText: view.createdText,
      dishLines,
      dishSummary:
        dishLines.length > MAX_DISH_LINES ? `${shown} 等 ${dishLines.length} 项` : shown,
      cancelled: order.status === 'CANCELLED',
    };
  });
  return {
    cards,
    emptyText: EMPTY_TEXT,
    countText: `共 ${cards.length} 笔订单`,
  };
}

export function toOrderListErrorView(error: SourceError | null): OrderListErrorView | null {
  if (!error) {
    return null;
  }
  const semantics = resolveListSemantics(error);
  const action: OrderListErrorAction = semantics.action === 'login' ? 'login' : 'reload';
  return {
    code: error.code,
    message: semantics.message,
    action,
    actionLabel: ACTION_LABELS[action],
  };
}