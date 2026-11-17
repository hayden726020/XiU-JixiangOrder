import type { SourceError, StudentMode, StudentOrder } from '../types';
import { ACTION_LABELS, resolveListSemantics } from './errorSemantics';
import { toOrderStatusView } from './orderStatusView';

export interface OrderListDishLine {
  name: string;
  quantity: number;
}

export interface OrderListCardView {
  id: string;
  status: string;
  statusLabel: string;
  statusType: 'ready' | 'preparing' | 'completed' | 'cancelled';
  shopText: string | null;
  shopName: string;
  totalText: string;
  diningMode: 'DINE_IN' | 'TAKEAWAY';
  diningModeText: string;
  slotRangeText: string;
  timeDiningText: string;
  createdText: string;
  dishLines: OrderListDishLine[];
  dishSummary: string;
  primaryDishName: string;
  primaryQuantity: number;
  cancelled: boolean;
  actionText: string;
  actionType: 'primary' | 'outline';
  polaroidKey: 'fengwei' | 'mianshi' | 'dazhong';
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

    const firstItem = order.items?.[0];
    const primaryDishName = firstItem?.name || '精选餐品';
    const primaryQuantity = firstItem?.quantity || 1;

    // 清洗店铺名称
    const cleanShopName = (view.shop.showRow ? view.shop.text : '')
      .replace(/^.*[·•]/, '')
      .trim() || '大众窗口';

    // 拍立得照片分类
    let polaroidKey: 'fengwei' | 'mianshi' | 'dazhong' = 'dazhong';
    const textToMatch = `${cleanShopName} ${primaryDishName}`;
    if (/风味|鸡腿|小炒/i.test(textToMatch)) {
      polaroidKey = 'fengwei';
    } else if (/面|面食|牛肉/i.test(textToMatch)) {
      polaroidKey = 'mianshi';
    } else {
      polaroidKey = 'dazhong';
    }

    // 状态分类
    let statusType: 'ready' | 'preparing' | 'completed' | 'cancelled' = 'preparing';
    if (order.status === 'READY') {
      statusType = 'ready';
    } else if (order.status === 'COMPLETED') {
      statusType = 'completed';
    } else if (order.status === 'CANCELLED') {
      statusType = 'cancelled';
    } else {
      statusType = 'preparing';
    }

    // 按钮文案与形式
    const actionText = statusType === 'ready' ? '查看取餐码' : '查看详情';
    const actionType: 'primary' | 'outline' = statusType === 'ready' ? 'primary' : 'outline';

    // 就餐时段友好格式化
    let dayPrefix = '今天';
    if (order.slotStart?.includes('2026-11-12')) {
      dayPrefix = '昨天';
    }
    const matchTimes = /(\d{2}:\d{2})[^\d]*(\d{2}:\d{2})/.exec(view.slotRangeText);
    const shortRange = matchTimes ? `${matchTimes[1]}—${matchTimes[2]}` : '12:00—12:30';
    const timeDiningText = `${dayPrefix} ${shortRange} · ${view.diningModeText}`;

    return {
      id: view.orderId,
      status: order.status,
      statusLabel: view.statusLabel,
      statusType,
      shopText: view.shop.showRow ? view.shop.text : null,
      shopName: cleanShopName,
      totalText: view.totalText,
      diningMode: order.diningMode,
      diningModeText: view.diningModeText,
      slotRangeText: view.slotRangeText,
      timeDiningText,
      createdText: view.createdText,
      dishLines,
      dishSummary:
        dishLines.length > MAX_DISH_LINES ? `${shown} 等 ${dishLines.length} 项` : shown,
      primaryDishName,
      primaryQuantity,
      cancelled: order.status === 'CANCELLED',
      actionText,
      actionType,
      polaroidKey,
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