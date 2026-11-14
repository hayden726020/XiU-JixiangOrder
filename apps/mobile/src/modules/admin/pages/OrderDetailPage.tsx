import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import type { AdminSource } from '../data/source';
import type { Order, OrderStatus } from '../types';
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

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}（${error.code}）`;
  }
  return '读取订单详情失败，未显示样例数据。';
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
    return <p className="admin-muted">正在读取订单详情…</p>;
  }

  if (error) {
    return (
      <div className="notice admin-error" role="alert">
        <strong>订单详情读取失败</strong>
        <p>{error}</p>
        <p>未显示样例数据。请检查登录状态、管理员权限与服务地址。</p>
        <button type="button" className="admin-action" onClick={() => setAttempt((value) => value + 1)}>
          重试
        </button>
        <a href="#/admin/orders">← 返回订单列表</a>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="notice">
        <strong>订单不存在或对当前身份不可见</strong>
        <p>管理查询只读取服务端返回的订单，不会用样例订单替代。</p>
        <a href="#/admin/orders">← 返回订单列表</a>
      </div>
    );
  }

  const currentIndex = orderStatusIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="admin-section">
      <a href="#/admin/orders">← 返回订单列表</a>

      <div className="admin-detail__head">
        <div>
          <h3>订单详情</h3>
          <code>{order.id}</code>
        </div>
        <span className={`admin-tag admin-tag--${order.status.toLowerCase()}`}>
          {orderStatusText[order.status]}
        </span>
      </div>

      {isCancelled ? (
        <p className="admin-order__exception">已取消；取消原因：{order.cancellationReason ?? '未记录'}</p>
      ) : (
        <ol className="admin-status-flow" aria-label="订单状态进度">
          {STATUS_FLOW.map((status, index) => (
            <li
              key={status}
              className={index <= currentIndex ? 'admin-status-step admin-status-step--done' : 'admin-status-step'}
            >
              {orderStatusText[status]}
            </li>
          ))}
        </ol>
      )}

      <dl className="admin-kv">
        <div>
          <dt>档口</dt>
          <dd>{order.merchantName ?? order.merchantId ?? '服务端未返回档口字段'}</dd>
        </div>
        <div>
          <dt>预约时段</dt>
          <dd>
            {formatTime(order.slotStart)}—{formatTime(order.slotEnd)}
          </dd>
        </div>
        <div>
          <dt>用餐方式</dt>
          <dd>
            {diningModeText[order.diningMode]}
            {order.diningModeReason ? `（变更理由：${order.diningModeReason}）` : ''}
          </dd>
        </div>
        <div>
          <dt>菜品与份数</dt>
          <dd>
            <ul className="admin-items">
              {order.items.map((item) => (
                <li key={`${item.dishId}-${item.name}`}>
                  {item.name} × {item.quantity} · 单价 {formatFen(item.unitPriceFen)} · 小计{' '}
                  {formatFen(item.unitPriceFen * item.quantity)}
                </li>
              ))}
            </ul>
            合计 {itemQuantity(order)} 份
          </dd>
        </div>
        <div>
          <dt>订单金额</dt>
          <dd>{formatFen(order.totalFen)}（服务端计价）</dd>
        </div>
        <div>
          <dt>支付状态</dt>
          <dd>
            {order.paymentStatus === 'SIMULATED_PAID' ? '模拟已付款' : '模拟已退款'}
            ，不发生真实资金交易
          </dd>
        </div>
        <div>
          <dt>取消申请</dt>
          <dd>
            {order.cancelRequest.status === 'NONE'
              ? '无'
              : `${order.cancelRequest.status}${order.cancelRequest.reason ? ` · ${order.cancelRequest.reason}` : ''}`}
          </dd>
        </div>
        <div>
          <dt>延迟</dt>
          <dd>
            {order.delay
              ? `${order.delay.reason} · 预计可取 ${formatDateTime(order.delay.expectedReadyAt)}`
              : '未设置'}
          </dd>
        </div>
        <div>
          <dt>时间</dt>
          <dd>
            创建 {formatDateTime(order.createdAt)} · 更新 {formatDateTime(order.updatedAt)}
            {order.pickedUpAt ? ` · 取餐 ${formatDateTime(order.pickedUpAt)}` : ''}
          </dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>version {order.version}</dd>
        </div>
      </dl>

      <p className="hint">
        管理端只读：接单、制作、核销、取消审批均由档口端处理。本页不显示取餐码，也不提供任何写操作。
        {source.mode === 'live' ? ' 真实模式字段来自 GET /orders/{id} 的管理视角。' : ' 当前为样例数据。'}
      </p>
    </div>
  );
}