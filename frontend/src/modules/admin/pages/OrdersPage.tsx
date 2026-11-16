import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import '../admin-orders.css';
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

interface OrdersError {
  title: string;
  detail: string;
  canRelogin: boolean;
}

function describeError(error: unknown): OrdersError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        title: '身份失效',
        detail: `${error.message}（${error.code}）页面未显示任何订单，请重新登录管理员演示身份。`,
        canRelogin: true,
      };
    }
    if (error.status === 403) {
      return {
        title: '当前身份无管理权限',
        detail: `服务端拒绝了订单查询（${error.code}）。页面未显示任何订单，也不提供切换管理员的按钮。`,
        canRelogin: true,
      };
    }
    if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
      return {
        title: '订单查询未完成',
        detail: '服务暂不可用；这是查询请求，可按当前筛选重试。页面未显示样例数据。',
        canRelogin: false,
      };
    }
    if (error.status === 0 || error.code === 'NETWORK_TIMEOUT') {
      return {
        title: '订单查询未完成',
        detail: `${error.message}（${error.code}）请检查网络与服务地址后重试；页面未显示样例数据。`,
        canRelogin: false,
      };
    }
    return {
      title: '订单读取失败',
      detail: `${error.message}（${error.code}）`,
      canRelogin: false,
    };
  }
  return {
    title: '订单读取失败',
    detail: '无法读取订单，未显示样例数据。请检查服务地址与登录状态。',
    canRelogin: false,
  };
}

function exceptionDetail(order: Order): string | null {
  const details: string[] = [];
  if (order.delay) {
    details.push(`已设置延迟，预计 ${formatTime(order.delay.expectedReadyAt)} 可取`);
  }
  if (order.cancelRequest.status === 'PENDING') {
    details.push(
      `待处理取消申请${order.cancelRequest.reason ? ` · ${order.cancelRequest.reason}` : ''}`,
    );
  }
  return details.length > 0 ? details.join('；') : null;
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
  const [error, setError] = useState<OrdersError | null>(null);
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
  const refresh = () => setAttempt((value) => value + 1);

  return (
    <div className="admin-orders" aria-busy={loading}>
      <header className="admin-orders__header">
        <a href="#/admin" aria-label="返回管理端概览">管理端</a>
        <h2 className="admin-orders__title" id="admin-title">订单与异常查询</h2>
      </header>

      <div className="admin-orders__filters">
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
        <button
          type="button"
          className="admin-action admin-orders__refresh"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {loading ? <p className="admin-orders__loading" role="status">正在读取订单…</p> : null}

      {error ? (
        <div className="notice admin-error admin-orders__error" role="alert">
          <strong>{error.title}</strong>
          <p>{error.detail}</p>
          <p>请检查登录状态、管理员权限与服务地址后重试。</p>
          <button type="button" className="admin-action" onClick={refresh}>
            重试
          </button>
          {error.canRelogin ? <a href="#/system-check">去公共自检页重新登录或检查服务 →</a> : null}
        </div>
      ) : null}

      {!loading && !error && result ? (
        visibleOrders.length === 0 ? (
          <>
            <div className="admin-orders__empty-state" role="status">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="M13 8.5h17l7 7v24H13z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M30 8.5v7h7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M18.5 24h11M18.5 29h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="32.5" cy="34" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m36.2 37.7 2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <h3>当前条件下没有订单</h3>
              <p>
                {exception === 'ALL'
                  ? '可切换状态或刷新重试'
                  : '可切换状态、调整异常筛选或刷新重试'}
              </p>
              <button
                type="button"
                className="admin-action admin-orders__empty-refresh"
                onClick={refresh}
              >
                刷新
              </button>
            </div>
            <div className="admin-pager admin-orders__empty-pager" aria-label="订单分页">
              <span>第 {page} 页</span>
            </div>
          </>
        ) : (
          <>
            <p className="admin-orders__summary">
              {source.mode === 'live' ? '服务端' : '样例'}共 {total} 笔，当前第 {page} 页，每页 {PAGE_SIZE} 笔，
              当前页 {loadedOrders.length} 笔，其中异常标记 {exceptionCount} 笔
              {exception !== 'ALL' ? `，异常筛选后显示 ${visibleOrders.length} 笔` : ''}。
            </p>

            <ul className="admin-order-list" aria-label="订单列表">
              {visibleOrders.map((order) => {
                const exceptionLabel = exceptionDetail(order);
                return (
                  <li key={order.id}>
                    <a
                      className="admin-order admin-order--link"
                      href={`#/admin/orders/${encodeURIComponent(order.id)}`}
                      aria-label={`查看订单 ${order.id} 的只读详情`}
                    >
                      <div className="admin-order__head">
                        <code className="admin-order__id">{order.id}</code>
                        <span className={`admin-tag admin-tag--${order.status.toLowerCase()}`}>
                          {orderStatusText[order.status]}
                        </span>
                      </div>
                      <div className="admin-order__meta">
                        <span>
                          <strong>{order.merchantName ?? order.merchantId ?? '档口字段未返回'}</strong>
                          {' · '}{formatTime(order.slotStart)}–{formatTime(order.slotEnd)}
                        </span>
                        <span>
                          {diningModeText[order.diningMode]} · {itemQuantity(order)} 份 · {formatFen(order.totalFen)}
                        </span>
                        <span className="admin-orders__created">
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

            <div className="admin-pager" aria-label="订单分页">
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
        )
      ) : null}
    </div>
  );
}