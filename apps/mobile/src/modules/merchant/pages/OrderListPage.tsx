
import OrderRow from '../components/OrderRow';
import { DEMO_SCENARIOS } from '../data/sampleData';
import type { MerchantOrder, MerchantScenario } from '../data/types';
import type { ActionInput, OrderAction } from '../state/actionMatrix';
import { groupOrders } from '../state/orderView';

interface OrderListPageProps {
  orders: MerchantOrder[];
  scenario: MerchantScenario;
  isSample: boolean;
  onboardingCompleted: boolean;
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
  onOpenSetup: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastRefreshedAt: string | null;
  autoRefreshSeconds: number;
}

export default function OrderListPage({
  orders,
  scenario,
  isSample,
  onboardingCompleted,
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
  onOpenSetup,
  onRefresh,
  refreshing,
  lastRefreshedAt,
  autoRefreshSeconds,
}: OrderListPageProps) {

  const groups = groupOrders(orders, { includeEmpty: true });
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? groups[0];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeOrders = [...activeGroup.orders].sort((left, right) => {
    const slotOrder = left.slotStart.localeCompare(right.slotStart);
    return slotOrder !== 0 ? slotOrder : left.createdAt.localeCompare(right.createdAt);
  });

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
          {!isSample && (
            <button
              type="button"
              className="merchant-link-button"
              onClick={onOpenSetup}
              data-open-onboarding
              data-onboarding-state={onboardingCompleted ? 'completed' : 'pending'}
            >
              {onboardingCompleted ? '店铺信息' : '商家注册 / 开店'}
            </button>
          )}
          <button type="button" className="merchant-link-button" onClick={onOpenMenu} data-open-menu>
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
        <p className="merchant-empty">订单读取失败：{error}</p>
      ) : orders.length === 0 ? (
        <p className="merchant-empty">
          {total > 0
            ? '本页没有订单，请返回上一页。'
            : isSample ? '暂无订单，样例模式下可切换演示场景。' : '服务返回 0 笔订单。'}
        </p>
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
                  <span
                    className={`merchant-status-chip__count${group.key === 'new' && group.count > 0 ? ' merchant-status-chip__count--alert' : ''}`}
                    aria-label={`${group.count} 笔${group.label}`}
                  >
                    {group.count}
                  </span>
                </button>
              );
            })}
          </div>

          {activeGroup.count === 0 ? (
            <p className="merchant-empty">「{activeGroup.label}」暂无订单。</p>
          ) : (
            <section className="order-group" aria-label={activeGroup.label}>
              <div className="order-group__bar">
                <span className="order-group__bar-title">{activeGroup.label}</span>
                <span className="order-group__bar-meta">共 {activeGroup.count} 笔 · 按取餐时间排序</span>
                {activeGroup.hasPendingCancel && <span className="merchant-flag">有取消申请</span>}
              </div>
              <div className="order-group__rows">
                {activeOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onOpen={onOpenOrder}
                    onAction={onAction}
                    pendingCode={pendingCode}
                    pendingOrderId={pendingOrderId}
                    actionError={actionError}

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
            <p className="hint">档口共 {total} 笔订单，本页 {orders.length} 笔；点击查看详情。</p>
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