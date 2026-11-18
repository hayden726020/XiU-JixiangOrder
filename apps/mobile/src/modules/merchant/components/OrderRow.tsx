import { useState } from 'react';
import type { MerchantOrder } from '../data/types';
import { getOrderActions, getPrimaryAction, type ActionInput, type OrderAction } from '../state/actionMatrix';
import { cancellationNote, diningModeView, formatSlot, hasPendingCancel, orderNoLabel, statusView } from '../state/orderView';
import { formatYuan, itemsSummary, totalQuantity } from '../utils/money';

interface OrderRowProps {
  order: MerchantOrder;
  onOpen: (id: string) => void;
  onAction: (orderId: string, action: OrderAction, input?: ActionInput) => void;
  pendingCode: string | null;
  pendingOrderId: string | null;
  actionError: { code: string; message: string; orderId?: string } | null;
  showCancellationDetails?: boolean;
}

export default function OrderRow({
  order,
  onOpen,
  onAction,
  pendingCode,
  pendingOrderId,
  actionError,
  showCancellationDetails = true,
}: OrderRowProps) {
  const [pickupCode, setPickupCode] = useState('');
  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const primary = getPrimaryAction(order);
  const verifyAction = getOrderActions(order).find((action) => action.code === 'VERIFY') ?? null;
  const isPending = pendingOrderId === order.id && pendingCode !== null;
  const rowError = actionError?.orderId === order.id ? actionError : null;
  const canAct = Boolean(primary || verifyAction);

  function act(action: OrderAction, input: ActionInput = {}) {
    onAction(order.id, action, input);
  }

  function stop(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation();
  }

  return (
    <article
      className={`order-row order-row--${status.tone}`}
      data-order-id={order.id}
      data-status={order.status}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(order.id);
        }
      }}
    >
      <div className="order-row__head">
        <span className="order-row__ident">
          <span className="order-row__id" title={order.id}>{orderNoLabel(order)}</span>
          <span className={`merchant-tag merchant-tag--${status.tone}`}>{status.label}</span>
          <span className={`merchant-tag merchant-tag--${dining.tone}`}>{dining.label}</span>
          {hasPendingCancel(order) && <span className="merchant-flag">取消申请</span>}
        </span>
        <span className="order-row__slot">{formatSlot(order)}</span>
      </div>

      <div className="order-row__content">
        <span className="order-row__items">{itemsSummary(order.items)}</span>
        <span className="order-row__amount">
          共 {totalQuantity(order.items)} 份 · {formatYuan(order.totalFen)}
        </span>
      </div>

      {order.remark && (
        <span className="order-row__remark" data-order-remark={order.remark}>
          <span className="order-row__remark-label">备注</span>
          <span className="order-row__remark-text">{order.remark}</span>
        </span>
      )}

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

      <div className="order-row__foot" onClick={stop}>
        <button
          type="button"
          className="order-row__detail"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(order.id);
          }}
        >
          查看详情
        </button>

        {primary && primary.code !== 'VERIFY' && (
          <button
            type="button"
            className="order-row__primary"
            onClick={(event) => {
              event.stopPropagation();
              act(primary);
            }}
            disabled={isPending}
            aria-busy={isPending || undefined}
          >
            {isPending ? '提交中…' : primary.label}
          </button>
        )}

        {verifyAction && (
          <span className="order-row__verify" onClick={stop} onKeyDown={stop}>
            <input
              value={pickupCode}
              onChange={(event) => setPickupCode(event.target.value)}
              placeholder="取餐码"
              aria-label={`${orderNoLabel(order)} 取餐码`}
              onClick={stop}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.stopPropagation();
                  act(verifyAction, { pickupCode });
                }
              }}
            />
            <button
              type="button"
              className="order-row__primary"
              onClick={(event) => {
                event.stopPropagation();
                act(verifyAction, { pickupCode });
              }}
              disabled={isPending}
              aria-busy={isPending || undefined}
            >
              {isPending ? '核销中…' : '核销'}
            </button>
          </span>
        )}

        {!canAct && <span className="order-row__muted">无待办操作</span>}
      </div>

      {rowError && (
        <p className="action-feedback action-feedback--error" role="alert" onClick={stop}>
          {rowError.message}
        </p>
      )}
    </article>
  );
}