import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import '../admin-order-detail.css';
import type { AdminSource } from '../data/source';
import type { CancelRequestStatus, Order, OrderStatus } from '../types';
import {
  diningModeText,
  formatDateTime,
  formatFen,
  formatTime,
  itemQuantity,
  orderStatusIndex,
  orderStatusText,
} from '../utils/display';

const STATUS_FLOW: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

const cancelStatusText: Record<CancelRequestStatus, string> = {
  NONE: '无',
  PENDING: '待处理',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.code === 'NETWORK_TIMEOUT') {
      return '请求超时，未获取到订单详情';
    }
    return `${error.message}（${error.code}）`;
  }
  return '读取订单详情失败，未获取到订单详情';
}

function navigateToOrders(): void {
  window.history.pushState(null, '', '#/admin/orders');
  window.dispatchEvent(new Event('hashchange'));
}

function BackToOrders({ inline = false }: { inline?: boolean }) {
  return (
    <a
      className={`admin-order-detail__back${inline ? ' admin-order-detail__back--inline' : ''}`}
      href="#/admin/orders"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        navigateToOrders();
      }}
    >
      ← 返回订单列表
    </a>
  );
}

function cancelRequestDetail(order: Order): string {
  const status = cancelStatusText[order.cancelRequest.status];
  if (order.cancelRequest.status === 'NONE' || order.cancelRequest.status === 'APPROVED') {
    return status;
  }
  const reason = order.cancelRequest.reason ?? order.cancellationReason;
  return reason ? `${status} · ${reason}` : status;
}

interface OrderDetailPageProps {
  source: AdminSource;
  orderId: string;
}

export default function OrderDetailPage({ source, orderId }: OrderDetailPageProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOrder(null);
    source
      .getOrder(orderId)
      .then((next) => {
        if (!cancelled) {
          setOrder(next);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(describeError(loadError));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, orderId, attempt]);

  if (loading) {
    return (
      <div className="admin-order-detail">
        <BackToOrders />
        <p className="admin-order-detail__loading" role="status">正在读取订单详情…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-order-detail admin-order-detail--fallback">
        <div className="admin-order-detail__fallback-state">
          <section
            className="admin-order-detail__fallback admin-order-detail__fallback--error"
            role="alert"
          >
            <strong>订单详情读取失败</strong>
            <p>{error}</p>
            <div className="admin-order-detail__fallback-actions">
              <button
                type="button"
                className="admin-action"
                onClick={() => setAttempt((value) => value + 1)}
              >
                重试
              </button>
              <BackToOrders inline />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="admin-order-detail admin-order-detail--fallback">
        <div className="admin-order-detail__fallback-state">
          <section
            className="admin-order-detail__fallback admin-order-detail__fallback--not-found"
            role="status"
          >
            <strong>订单不存在或对当前身份不可见</strong>
            <p>管理查询只读取服务端返回的订单，不会用样例订单替代</p>
            <div className="admin-order-detail__fallback-actions">
              <BackToOrders inline />
            </div>
          </section>
        </div>
      </div>
    );
  }

  const currentIndex = orderStatusIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const cancellationReason = order.cancellationReason ?? order.cancelRequest.reason;

  return (
    <article className={`admin-order-detail${isCancelled ? ' admin-order-detail--cancelled' : ''}`}>
      <BackToOrders />

      <header className="admin-order-detail__header">
        <h2 id="admin-title">订单详情</h2>
        <div className="admin-order-detail__order-head">
          <code>{order.orderNo ?? order.id}</code>
          <span className={`admin-tag admin-tag--${order.status.toLowerCase()}`}>
            {orderStatusText[order.status]}
          </span>
        </div>
      </header>

      {isCancelled ? (
        <div className="admin-order-detail__cancelled" role="note" aria-label="取消提示">
          <strong>已取消</strong>；取消原因：{cancellationReason ?? '未记录'}
        </div>
      ) : (
        <ol className="admin-order-detail__steps" aria-label="订单进度">
          {STATUS_FLOW.map((status, index) => {
            const complete = index <= currentIndex;
            const before = index < currentIndex;
            return (
              <li
                key={status}
                className={`${complete ? 'is-complete' : ''}${before ? ' is-before' : ''}`}
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                <span className="admin-order-detail__step-icon" aria-hidden="true">
                  {complete ? '✓' : ''}
                </span>
                <span>{orderStatusText[status]}</span>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="admin-order-detail__info">
        <div className="admin-order-detail__row">
          <dt>档口</dt>
          <dd>{order.merchantName ?? order.merchantId ?? '档口信息未提供'}</dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>预约时段</dt>
          <dd>{formatTime(order.slotStart)}—{formatTime(order.slotEnd)}</dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>用餐方式</dt>
          <dd>
            {diningModeText[order.diningMode]}
            {order.diningModeReason ? ` · ${order.diningModeReason}` : ''}
          </dd>
        </div>
        <div className="admin-order-detail__row admin-order-detail__row--items">
          <dt>菜品与份数</dt>
          <dd>
            <div className="admin-order-detail__items">
              {order.items.map((item) => (
                <div key={`${item.dishId}-${item.name}`}>
                  <span>{item.name} × {item.quantity}</span>
                  <span>单价 {formatFen(item.unitPriceFen)}</span>
                  <span>小计 {formatFen(item.unitPriceFen * item.quantity)}</span>
                </div>
              ))}
              <strong>合计 {itemQuantity(order)} 份</strong>
            </div>
          </dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>订单金额</dt>
          <dd>{formatFen(order.totalFen)}（服务端计价）</dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>支付状态</dt>
          <dd>{order.paymentStatus === 'SIMULATED_PAID' ? '模拟已付款' : '模拟已退款'}</dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>取消申请</dt>
          <dd>{cancelRequestDetail(order)}</dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>延迟</dt>
          <dd>
            {order.delay
              ? `${order.delay.reason} · 预计 ${formatDateTime(order.delay.expectedReadyAt)} 可取`
              : '未设置'}
          </dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>时间</dt>
          <dd>
            创建 {formatDateTime(order.createdAt)} · 更新 {formatDateTime(order.updatedAt)}
            {order.pickedUpAt ? ` · 取餐 ${formatDateTime(order.pickedUpAt)}` : ''}
          </dd>
        </div>
        <div className="admin-order-detail__row">
          <dt>版本</dt>
          <dd>version {order.version}</dd>
        </div>
      </dl>

      <p className="admin-order-detail__notice">
        管理端只读，由档口端处理接单、制作与核销；本页不显示取餐码，无写操作
      </p>
    </article>
  );
}