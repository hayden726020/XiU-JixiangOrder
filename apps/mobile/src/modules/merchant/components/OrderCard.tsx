import { useState } from 'react';
import type { MerchantOrder } from '../data/types';
import { getOrderActions, getPrimaryAction, type ActionInput, type OrderAction } from '../state/actionMatrix';
import {
  cancellationNote,
  diningModeView,
  formatSlot,
  orderNoLabel,
  pendingRequestSummary,
  pickupTiming,
  statusView,
} from '../state/orderView';
import { formatYuan, itemsSummary, totalQuantity } from '../utils/money';
import {
  IconCheck,
  IconClock3,
  IconFileText,
  IconMessageSquareText,
  IconUtensils,
} from './MerchantIcons';

interface OrderCardProps {
  order: MerchantOrder;
  onOpen: (id: string) => void;
  onAction: (orderId: string, action: OrderAction, input?: ActionInput) => void;
  pendingCode: string | null;
  pendingOrderId: string | null;
  actionError: { code: string; message: string; orderId?: string } | null;
  showCancellationDetails?: boolean;
  showOverdue?: boolean;
  pendingOnly?: boolean;
  now?: number;
}

function actionLabel(action: OrderAction): string {
  if (action.code === 'MARK_READY') return '完成制作';
  if (action.code === 'VERIFY') return '核销取餐码';
  return action.label;
}

export default function OrderCard({
  order,
  onOpen,
  onAction,
  pendingCode,
  pendingOrderId,
  actionError,
  showCancellationDetails = true,
  showOverdue = true,
  pendingOnly = false,
  now = Date.now(),
}: OrderCardProps) {
  const [pickupCode, setPickupCode] = useState('');
  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const primary = getPrimaryAction(order);
  const verifyAction = getOrderActions(order).find((action) => action.code === 'VERIFY') ?? null;
  const isPending = pendingOrderId === order.id && pendingCode !== null;
  const rowError = actionError?.orderId === order.id ? actionError : null;
  const isTerminal = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const pendingSummary = pendingRequestSummary(order);
  const timing = showOverdue ? pickupTiming(order, now) : null;
  const overdue = timing?.tone === 'overdue';
  const terminalLabel = order.status === 'CANCELLED' ? '查看取消信息' : '查看详情';

  function stop(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation();
  }

  function act(action: OrderAction, input: ActionInput = {}) {
    onAction(order.id, action, input);
  }

  return (
    <article
      className={`order-row${overdue ? ' is-overdue' : ''}`}
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
          {pendingSummary && (
            <span className="merchant-flag merchant-flag--pending">待处理 · {pendingSummary}</span>
          )}
        </span>
      </div>

      <div className="order-row__time-row">
        <span className="order-row__slot">
          <IconClock3 size={15} />
          <span>{formatSlot(order)}</span>
        </span>
        {timing && (
          <span className={`order-row__pickup-timing is-${timing.tone}`} data-pickup-timing={timing.tone}>
            {timing.label}
          </span>
        )}
        <span className="order-row__amount">
          共 {totalQuantity(order.items)} 份 · {formatYuan(order.totalFen)}
        </span>
      </div>

      <div className="order-row__items">
        <IconUtensils size={14} />
        <span>{itemsSummary(order.items)}</span>
      </div>

      {order.remark && (
        <div className="order-row__remark" data-order-remark={order.remark}>
          <span className="order-row__remark-label">
            <IconMessageSquareText size={14} />
            备注
          </span>
          <span className="order-row__remark-text">{order.remark}</span>
        </div>
      )}

      {showCancellationDetails && order.status === 'CANCELLED' && (
        <div className="order-row__cancel" data-cancel-reason={cancellationNote(order)}>
          <span>取消说明：{cancellationNote(order)}</span>
          {order.paymentStatus === 'SIMULATED_REFUNDED' && (
            <span className="merchant-flag merchant-flag--refund" data-payment-status="SIMULATED_REFUNDED">
              模拟退款
            </span>
          )}
        </div>
      )}

      <div className="order-row__foot" onClick={stop}>
        {pendingOnly ? (
          <button
            type="button"
            className="order-row__detail"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(order.id);
            }}
          >
            <IconFileText size={14} />
            处理申请
          </button>
        ) : isTerminal ? (
          <button
            type="button"
            className="order-row__primary order-row__primary--muted"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(order.id);
            }}
          >
            <IconFileText size={14} />
            {terminalLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="order-row__detail"
onClick={(event) => {
                  event.stopPropagation();
                  onOpen(order.id);
                }}
              >
                <IconFileText size={14} />
                查看详情
              </button>

            {verifyAction ? (
              <span className="order-row__verify" onClick={stop} onKeyDown={stop}>
                <input
                  value={pickupCode}
                  onChange={(event) => setPickupCode(event.target.value)}
                  placeholder="输入取餐码"
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
                  {isPending ? '核销中…' : (
                    <>
                      <IconCheck size={15} />
                      核销取餐码
                    </>
                  )}
                </button>
              </span>
            ) : primary ? (
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
                {isPending ? '提交中…' : (
                  <>
                    <IconCheck size={15} />
                    {actionLabel(primary)}
                  </>
                )}
              </button>
            ) : (
              <span className="order-row__muted">当前没有可执行操作</span>
            )}
          </>
        )}
      </div>

      {rowError && (
        <p className="action-feedback action-feedback--error" role="alert" onClick={stop}>
          {rowError.message}
        </p>
      )}
    </article>
  );
}