import type { MerchantOrder } from '../data/types';

function orderDateKey(order: Pick<MerchantOrder, 'slotStart' | 'createdAt'>): string {
  const fromSlot = order.slotStart.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fromSlot) ? fromSlot : order.createdAt.slice(0, 10);
}

/**
 * 档口取餐顺序：当天订单按取餐时间升序，未来日期紧随其后，历史日期排最后并按时间倒序。
 * 避免跨日期订单把当天待处理订单压到列表后面。
 */
export function sortOrdersForPickup(
  orders: MerchantOrder[],
  businessDate: string,
): MerchantOrder[] {
  function dayRank(order: MerchantOrder): number {
    const date = orderDateKey(order);
    if (date === businessDate) return 0;
    return date > businessDate ? 1 : 2;
  }

  return [...orders].sort((left, right) => {
    const leftRank = dayRank(left);
    const rightRank = dayRank(right);
    if (leftRank !== rightRank) return leftRank - rightRank;

    const slotOrder = leftRank === 2
      ? right.slotStart.localeCompare(left.slotStart)
      : left.slotStart.localeCompare(right.slotStart);
    if (slotOrder !== 0) return slotOrder;
    return left.createdAt.localeCompare(right.createdAt);
  });
}