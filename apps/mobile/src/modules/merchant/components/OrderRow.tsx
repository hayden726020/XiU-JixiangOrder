import type { MerchantOrder } from '../data/types';
import { getPrimaryAction } from '../state/actionMatrix';
import { diningModeView, formatSlot, hasPendingCancel, shortOrderId, statusView } from '../state/orderView';
import { itemsSummary, totalQuantity } from '../utils/money';

interface OrderRowProps {
  order: MerchantOrder;
  onOpen: (id: string) => void;
}

export default function OrderRow({ order, onOpen }: OrderRowProps) {
  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const primary = getPrimaryAction(order);
  const nextStep = primary
    ? `下一步：${primary.label}`
    : (order.status === 'CANCELLED' ? '订单已取消' : '无可用操作');

  return (
    <button type="button" className="order-row" onClick={() => onOpen(order.id)}>
      <span className="order-row__top">
        <span className="order-row__id">{shortOrderId(order.id)}</span>
        <span className={`merchant-tag merchant-tag--${status.tone}`}>{status.label}</span>
        <span className={`merchant-tag merchant-tag--${dining.tone}`}>{dining.label}</span>
        {hasPendingCancel(order) && <span className="merchant-flag">取消申请待处理</span>}
      </span>
      <span className="order-row__main">
        <span className="order-row__slot">{formatSlot(order)}</span>
        <span className="order-row__items">{itemsSummary(order.items)}</span>
      </span>
      <span className="order-row__bottom">
        <span>共 {totalQuantity(order.items)} 份</span>
        <span className="order-row__next">{nextStep}</span>
      </span>
    </button>
  );
}