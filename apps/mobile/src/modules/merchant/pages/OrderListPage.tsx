import { useEffect, useState } from 'react';
import OrderCard from '../components/OrderCard';
import { DEMO_SCENARIOS } from '../data/sampleData';
import type { MerchantOrder, MerchantScenario } from '../data/types';
import type { ActionInput, OrderAction } from '../state/actionMatrix';
import { groupOrders, sortOrdersForPickup } from '../state/orderView';
import { IconClipboardList, IconReceiptText, IconUtensils } from '../components/MerchantIcons';

interface OrderListPageProps {
  orders: MerchantOrder[];
  scenario: MerchantScenario;
  isSample: boolean;
  businessDate: string;

  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  activeGroupKey: string;
  onGroupChange: (groupKey: string) => void;
  onScenarioChange: (scenario: MerchantScenario) => void;
  onPageChange: (page: number) => void;
  onOpenOrder: (id: string) => void;
  onAction: (orderId: string, action: OrderAction, input?: ActionInput) => void;
  pendingCode: string | null;
  pendingOrderId: string | null;
  actionError: { code: string; message: string; orderId?: string } | null;
  onOpenMenu: () => void;
  onOpenPrep: () => void;

  onRefresh: () => void;
  refreshing: boolean;
  lastRefreshedAt: string | null;
  autoRefreshSeconds: number;
}

export default function OrderListPage({
  orders,
  scenario,
  isSample,
  businessDate,

  loading,
  error,
  page,
  pageSize,
  total,
  activeGroupKey,
  onGroupChange,
  onScenarioChange,
  onPageChange,
  onOpenOrder,
  onAction,
  pendingCode,
  pendingOrderId,
  actionError,
  onOpenMenu,
  onOpenPrep,

  onRefresh,
  refreshing,
  lastRefreshedAt,
  autoRefreshSeconds,
}: OrderListPageProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const groups = groupOrders(orders, { includeEmpty: true });
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? groups[0];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeOrders = activeGroup.key === 'pending'
    ? [...activeGroup.orders].sort((left, right) => {
      const timeOrder = right.updatedAt.localeCompare(left.updatedAt);
      return timeOrder !== 0 ? timeOrder : right.id.localeCompare(left.id);
    })
    : sortOrdersForPickup(activeGroup.orders, businessDate);

  return (
    <div className="merchant-view merchant-order-list">
      <header className="merchant-view__header">
        <div>
          <h2>
            订单
            {isSample && <span className="merchant-readonly-tag">样例 · demo=true</span>}
          </h2>
          <p className="lead">
            {isSample
              ? '按状态切换；卡片内可直接接单、制作、标记可取和核销。'
              : '按状态切换；高频操作在卡片内完成，成功后以服务端最新状态为准。'}
          </p>
        </div>
        <div className="merchant-view__actions">
          <button type="button" className="merchant-link-button" onClick={onOpenPrep} data-open-prep>
            <IconClipboardList size={15} />
            备餐汇总
          </button>
          <button type="button" className="merchant-link-button" onClick={() => onOpenMenu()} data-open-menu>
            <IconUtensils size={15} />
            菜单与库存
          </button>
        </div>
      </header>

      {!isSample && (
        <div className="merchant-refresh-bar" role="status">
          <span>
            每 {autoRefreshSeconds} 秒自动刷新
            {lastRefreshedAt ? ` · 最近更新 ${lastRefreshedAt}` : ' · 等待首次刷新'}
          </span>
          <button
            type="button"
            className="merchant-link-button merchant-refresh-bar__button"
            onClick={onRefresh}
            disabled={refreshing || loading}
            aria-busy={refreshing || undefined}
            data-refresh-orders
          >
            {refreshing ? '刷新中…' : '刷新列表'}
          </button>
        </div>
      )}

      {isSample && (
        <label className="merchant-scenario">
          <span>样例场景</span>
          <select
            value={scenario}
            onChange={(event) => onScenarioChange(event.target.value as MerchantScenario)}
          >
            {DEMO_SCENARIOS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}

      {loading ? (
        <p className="merchant-empty">正在读取订单…</p>
      ) : error ? (
        <div className="merchant-empty merchant-empty--error">
          <p>订单读取失败：{error}</p>
          <button
            type="button"
            className="action-button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
          >
            {refreshing ? '重试中…' : '重新加载'}
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="merchant-empty merchant-empty--state">
          <IconReceiptText size={30} />
          <p>
            {total > 0
              ? '本页没有订单，请返回上一页。'
              : isSample ? '暂无订单，样例模式下可切换演示场景。' : '服务返回 0 笔订单。'}
          </p>
        </div>
      ) : (
        <>
          <div className="merchant-status-bar" role="group" aria-label="按订单状态查看">
            {groups.map((group) => {
              const active = group.key === activeGroup.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  className={`merchant-status-chip${active ? ' merchant-status-chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => onGroupChange(group.key)}
                  data-order-status={group.key}
                >
                  <span className="merchant-status-chip__label">{group.label}</span>
                  {group.key === 'pending' || group.key === 'new' ? (
                    group.count > 0 && (
                      <span
                        className="merchant-status-chip__badge merchant-status-chip__badge--alert"
                        aria-label={`${group.count} 笔${group.label}`}
                      >
                        {group.count}
                      </span>
                    )
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeGroup.count === 0 ? (
            <div className="merchant-empty merchant-empty--state">
              <IconReceiptText size={30} />
              <p>
                {activeGroup.key === 'pending'
                  ? '暂无待处理申请：学生可申请退款或更改用餐方式。'
                  : `「${activeGroup.label}」暂无订单。`}
              </p>
            </div>
          ) : (
            <section className="order-group" aria-label={activeGroup.label}>
              <h3 className="order-group__title">
                {activeGroup.label}
                <span className="order-group__count">{activeGroup.count}</span>
                <span className="order-group__sort">
                  {activeGroup.key === 'pending' ? '按申请时间排序' : '按取餐时间排序'}
                </span>

              </h3>
              <div className="order-group__rows">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={onOpenOrder}
                    onAction={onAction}
                    pendingCode={pendingCode}
                    pendingOrderId={pendingOrderId}
                    actionError={actionError}
                    showCancellationDetails
                    showOverdue={!isSample}
                    pendingOnly={activeGroup.key === 'pending'}
                    now={now}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {!loading && !error && total > 0 && (
        <>
          {!isSample && (
            <p className="hint">
              档口共 {total} 笔订单，本页 {orders.length} 笔
              {total > orders.length ? '；状态数量按本页统计，可用分页查看其余订单' : ''}
              ；点击卡片查看详情。
            </p>
          )}
          {totalPages > 1 && (
            <nav className="merchant-pager" aria-label="订单分页">
              <button
                type="button"
                className="merchant-link-button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                上一页
              </button>
              <span className="merchant-pager__status">
                第 {page} / {totalPages} 页 · 共 {total} 笔
              </span>
              <button
                type="button"
                className="merchant-link-button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                下一页
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}