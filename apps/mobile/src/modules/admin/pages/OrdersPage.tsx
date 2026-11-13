import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import type { AdminOrderPage, AdminSource } from '../data/source';
import type { ExceptionFilter, Order, OrderStatus } from '../types';
import {
  diningModeText,
  exceptionText,
  formatDateTime,
  formatFen,
  formatTime,
  itemQuantity,
  matchesException,
  orderStatusText,
} from '../utils/display';

const PAGE_SIZE = 10;

const statusOptions: Array<{ value: OrderStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  { value: 'NEW', label: orderStatusText.NEW },
  { value: 'ACCEPTED', label: orderStatusText.ACCEPTED },
  { value: 'PREPARING', label: orderStatusText.PREPARING },
  { value: 'READY', label: orderStatusText.READY },
  { value: 'COMPLETED', label: orderStatusText.COMPLETED },
  { value: 'CANCELLED', label: orderStatusText.CANCELLED },
];

const exceptionOptions: Array<{ value: ExceptionFilter; label: string }> = [
  { value: 'ALL', label: '全部订单' },
  { value: 'CANCELLATION_PENDING', label: '待处理取消申请' },
  { value: 'DELAYED', label: '已设置延迟' },
];

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}（${error.code}）`;
  }
  return '读取订单失败，未显示样例数据。';
}

interface OrdersPageProps {
  source: AdminSource;
}

export default function OrdersPage({ source }: OrdersPageProps) {
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [exception, setException] = useState<ExceptionFilter>('ALL');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminOrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    source
      .listOrders({ status, page, pageSize: PAGE_SIZE })
      .then((next) => {
        if (!cancelled) {
          setResult(next);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(describeError(loadError));
          setResult(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, status, page, attempt]);

  const loadedOrders: Order[] = result?.orders ?? [];
  const visibleOrders = loadedOrders.filter((order) => matchesException(order, exception));
  const exceptionCount = loadedOrders.filter((order) => exceptionText(order) !== null).length;
  const total = result?.total ?? 0;
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <div className="admin-section">
      <h3>订单与异常查询</h3>
      <p className="admin-muted">
        {source.mode === 'live'
          ? '真实服务只读查询，数据来自 GET /admin/orders。'
          : '样例只读查询，不会请求服务端。'}
        状态筛选与分页由服务端处理；异常筛选只作用于当前页已加载订单。
      </p>

      <div className="admin-filters">
        <label>
          <span>状态</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | 'ALL');
              setPage(1);
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>异常（当前页）</span>
          <select
            value={exception}
            onChange={(event) => setException(event.target.value as ExceptionFilter)}
          >
            {exceptionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-action" onClick={() => setAttempt((value) => value + 1)}>
          刷新
        </button>
      </div>

      {loading ? <p className="admin-muted">正在读取订单…</p> : null}

      {error ? (
        <div className="notice admin-error" role="alert">
          <strong>订单读取失败</strong>
          <p>{error}</p>
          <p>未显示样例数据。请检查登录状态、管理员权限与服务地址后重试。</p>
          <button type="button" className="admin-action" onClick={() => setAttempt((value) => value + 1)}>
            重试
          </button>
          <a href="#/system-check">去公共自检页检查登录与服务 →</a>
        </div>
      ) : null}

      {!loading && !error && result ? (
        <>
          <p className="admin-muted">
            服务端共 {total} 笔；当前第 {page} 页，每页 {PAGE_SIZE} 笔。当前页 {loadedOrders.length} 笔，
            其中异常标记 {exceptionCount} 笔
            {exception !== 'ALL' ? `，异常筛选后显示 ${visibleOrders.length} 笔` : ''}。
          </p>

          {visibleOrders.length === 0 ? (
            <p className="notice">
              {exception === 'ALL'
                ? '当前条件下没有订单。可切换状态或检查样例/真实模式。'
                : '当前页没有符合条件的异常订单；异常筛选不跨页。'}
            </p>
          ) : (
            <ul className="admin-order-list">
              {visibleOrders.map((order) => {
                const exceptionLabel = exceptionText(order);
                return (
                  <li key={order.id}>
                    <a
                      className="admin-order admin-order--link"
                      href={`#/admin/orders/${encodeURIComponent(order.id)}`}
                    >
                      <div className="admin-order__head">
                        <code className="admin-order__id">{order.id}</code>
                        <span className={`admin-tag admin-tag--${order.status.toLowerCase()}`}>
                          {orderStatusText[order.status]}
                        </span>
                      </div>
                      <div className="admin-order__meta">
                        <span>
                          <strong>{order.merchantName ?? order.merchantId ?? '档口字段未返回'}</strong> ·{' '}
                          {formatTime(order.slotStart)}—{formatTime(order.slotEnd)}
                        </span>
                        <span>
                          {diningModeText[order.diningMode]} · {itemQuantity(order)} 份 ·{' '}
                          {formatFen(order.totalFen)}
                        </span>
                        <span>
                          创建 {formatDateTime(order.createdAt)} · version {order.version}
                        </span>
                      </div>
                      {exceptionLabel ? (
                        <p className="admin-order__exception">{exceptionLabel}</p>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="admin-pager">
            <button
              type="button"
              className="admin-action"
              disabled={!hasPrev || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              ← 上一页
            </button>
            <span>第 {page} 页</span>
            <button
              type="button"
              className="admin-action"
              disabled={!hasNext || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              下一页 →
            </button>
          </div>
        </>
      ) : null}

      <p className="hint">
        真实接口当前只定义 <code>status</code>、<code>page</code>、<code>pageSize</code>；
        日期、档口与异常参数尚未定义，页面不发送这些参数。真实订单响应暂未返回档口名称，列表可能显示档口 ID 或“档口字段未返回”。管理查询恒不返回取餐码。
      </p>
    </div>
  );
}