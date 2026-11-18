import type { MerchantOrder } from '../data/types';
import { getPrimaryAction } from '../state/actionMatrix';
import { cancellationNote, diningModeView, formatSlot, orderNoLabel, pendingRequestSummary, statusView } from '../state/orderView';
import { customizationSummary, itemsSummary, totalQuantity } from '../utils/money';

interface OrderRowProps {
  order: MerchantOrder;
  onOpen: (id: string) => void;
  showCancellationDetails?: boolean;
}

export default function OrderRow({ order, onOpen, showCancellationDetails = true }: OrderRowProps) {
  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const primary = getPrimaryAction(order);
  const pendingSummary = pendingRequestSummary(order);
  const nextStep = primary
    ? `下一步：${primary.label}`
    : (order.status === 'CANCELLED' ? '订单已取消' : '无可用操作');

  const customLines = order.items
    .map((item) => ({ name: item.name, text: customizationSummary(item) }))
    .filter((entry) => entry.text !== '');

  return (
    <button type="button" className="order-row" data-order-id={order.id} data-status={order.status} onClick={() => onOpen(order.id)}>
      <span className="order-row__top">
        <span className="order-row__id" title={order.id}>{orderNoLabel(order)}</span>
        <span className={`merchant-tag merchant-tag--${status.tone}`}>{status.label}</span>
        <span className={`merchant-tag merchant-tag--${dining.tone}`}>{dining.label}</span>
        {pendingSummary && <span className="merchant-flag merchant-flag--pending">待处理 · {pendingSummary}</span>}
      </span>
      <span className="order-row__main">
        <span className="order-row__slot">{formatSlot(order)}</span>
        <span className="order-row__items">{itemsSummary(order.items)}</span>
      </span>
      {customLines.length > 0 && (
        <span className="order-row__custom">
          {customLines.map((entry) => (
            <span key={`${entry.name}-${entry.text}`}>{entry.name}：{entry.text}</span>
          ))}
        </span>
      )}
      {order.remark && (
        <span className="order-row__remark" data-order-remark={order.remark}>
          <span className="order-row__remark-label">备注</span>
          <span className="order-row__remark-text">{order.remark}</span>
        </span>
      )}
      <span className="order-row__bottom">
        <span>共 {totalQuantity(order.items)} 份</span>
        <span className={`order-row__next${primary ? '' : ' order-row__next--muted'}`}>{nextStep}</span>
      </span>
      {showCancellationDetails && order.status === 'CANCELLED' && (
        <span className="order-row__cancel" data-cancel-reason={cancellationNote(order)}>
          <span>取消说明：{cancellationNote(order)}</span>
          {order.paymentStatus === 'SIMULATED_REFUNDED' && (
            <span className="merchant-flag merchant-flag--refund" data-payment-status="SIMULATED_REFUNDED">
              模拟退款
            </span>
          )}
        </span>
      )}
    </button>
  );
}