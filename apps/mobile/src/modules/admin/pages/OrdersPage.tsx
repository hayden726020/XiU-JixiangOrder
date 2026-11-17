import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import '../admin-orders.css';
import AdminBackLink from '../components/AdminBackLink';
import type {
  AdminErrorSimulation,
  AdminOrderPage,
  AdminSource,
} from '../data/source';
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

const errorDemoOptions: Array<{ value: AdminErrorSimulation; label: string }> = [
  { value: 'none', label: '正常订单' },
  { value: '401', label: '401' },
  { value: '403', label: '403' },
  { value: '503', label: '503' },
];

interface OrdersError {
  codeLabel: string;
  title: string;
  detail: string;
  canRelogin: boolean;
}

function describeError(error: unknown): OrdersError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        codeLabel: '401',
        title: '身份失效',
        detail: '页面未显示任何订单，请重新登录管理员身份',
        canRelogin: true,
      };
    }
    if (error.status === 403) {
      return {
        codeLabel: '403',
        title: '当前身份无管理权限',
        detail: '服务端拒绝了订单查询，页面未显示任何订单',
        canRelogin: true,
      };
    }
    if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
      return {
        codeLabel: '503',
        title: '订单查询未完成',
        detail: '服务暂不可用，可按当前筛选重试',
        canRelogin: false,
      };
    }
    if (error.status === 0 || error.code === 'NETWORK_TIMEOUT') {
      return {
        codeLabel: 'NETWORK',
        title: '订单查询未完成',
        detail: '网络连接异常，请检查网络与服务地址后按当前筛选重试',
        canRelogin: false,
      };
    }
    return {
      codeLabel: 'ERROR',
      title: '订单读取失败',
      detail: '订单查询未完成，请稍后按当前筛选重试',
      canRelogin: false,
    };
  }
  return {
    codeLabel: 'ERROR',
    title: '订单读取失败',
    detail: '订单查询未完成，请检查服务地址后重试',
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
  errorSimulation: AdminErrorSimulation;
  onErrorSimulationChange: (value: AdminErrorSimulation) => void;
  onShowSample: (simulation?: AdminErrorSimulation) => void;
}

export default function OrdersPage({
  source,
  errorSimulation,
  onErrorSimulationChange,
  onShowSample,
}: OrdersPageProps) {
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
  const isEmpty = !loading && !error && result !== null && visibleOrders.length === 0;
  const demoControls = source.mode === 'sample' ? (
    <div className="admin-orders__demo" aria-label="错误三态演示">
      <span>错误三态演示</span>
      <div>
        {errorDemoOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={errorSimulation === option.value}
            onClick={() => onErrorSimulationChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  if (error) {
    return (
      <div className="admin-orders admin-orders--error" aria-busy={loading}>
        <header className="admin-orders__header">
          <AdminBackLink to="/admin" label="返回管理端概览" />
          <h2 className="admin-orders__title" id="admin-title">订单与异常查询</h2>
        </header>
        {demoControls}
        <div className="admin-orders__error-state">
          <span className="admin-orders__error-code">{error.codeLabel}</span>
          <section className="admin-orders__error" role="alert" aria-labelledby="admin-orders-error-title">
            <h3 id="admin-orders-error-title">{error.title}</h3>
            <p>{error.detail}</p>
            <div className="admin-orders__error-actions">
              <button
                type="button"
                className="admin-action admin-orders__error-retry"
                onClick={refresh}
              >
                重试
              </button>
              {error.canRelogin ? (
                <a className="admin-orders__error-login" href="#/system-check">去登录</a>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-orders${isEmpty ? ' admin-orders--empty' : ''}`} aria-busy={loading}>
      <header className="admin-orders__header">
        <AdminBackLink to="/admin" label="返回管理端概览" />
        <h2 className="admin-orders__title" id="admin-title">订单与异常查询</h2>
      </header>

      {demoControls}

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

      {source.mode === 'live' ? (
        <button
          type="button"
          className="admin-orders__demo-entry"
          onClick={() => onShowSample('401')}
        >
          错误三态演示 →
        </button>
      ) : null}

      {loading ? <p className="admin-orders__loading" role="status">正在读取订单…</p> : null}

      {!loading && result ? (
        visibleOrders.length === 0 ? (
          <>
            <div className="admin-orders__empty-state" role="status">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path
                  d="M19.5 16.4v-2.7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2.7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M10.5 16.4h27v6.7h-27z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M12.6 23.1v13.4a2 2 0 0 0 2 2h18.8a2 2 0 0 0 2-2V23.1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path d="M17.6 30.6h12.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
              {source.mode === 'live' ? (
                <button
                  type="button"
                  className="admin-orders__sample-link"
                  onClick={() => {
                    setStatus('ALL');
                    setException('ALL');
                    setPage(1);
                    onShowSample();
                  }}
                >
                  查看异常演示 →
                </button>
              ) : null}
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