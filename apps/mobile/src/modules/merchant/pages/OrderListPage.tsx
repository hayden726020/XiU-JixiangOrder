import OrderRow from '../components/OrderRow';
import { DEMO_SCENARIOS } from '../data/sampleData';
import type { MerchantOrder, MerchantScenario } from '../data/types';
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
  onScenarioChange: (scenario: MerchantScenario) => void;
  onPageChange: (page: number) => void;
  onOpenOrder: (id: string) => void;
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
  onScenarioChange,
  onPageChange,
  onOpenOrder,
  onOpenMenu,
  onOpenSetup,
  onRefresh,
  refreshing,
  lastRefreshedAt,
  autoRefreshSeconds,
}: OrderListPageProps) {
  const groups = groupOrders(orders);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="merchant-view merchant-order-list">
      <header className="merchant-view__header">
        <div>
          <h2>
            订单列表
            {isSample && <span className="merchant-readonly-tag">样例 · demo=true</span>}
          </h2>
          <p className="lead">
            {isSample
              ? '按状态分组：堂食/外带与待处理取消申请一眼可见。'
              : '真实数据；按状态分组。接单、开始制作、标记可取与核销已接入服务端，成功后状态立即更新。'}
          </p>
        </div>
        <div className="merchant-view__actions">
          {!isSample && !onboardingCompleted && (
            <button type="button" className="merchant-link-button" onClick={onOpenSetup} data-open-onboarding>
              商家注册 / 开店
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
      ) : groups.length === 0 ? (
        <p className="merchant-empty">
          {total > 0
            ? '本页没有订单，请返回上一页。'
            : isSample ? '暂无订单，样例模式下可切换演示场景。' : '服务返回 0 笔订单。'}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="order-group">
            <h3 className="order-group__title">
              {group.label}
              <span className="order-group__count">{group.count}</span>
              {group.hasPendingCancel && <span className="merchant-flag">有取消申请</span>}
            </h3>
            <div className="order-group__rows">
              {group.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onOpen={onOpenOrder}
                  showCancellationDetails={!isSample}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {!loading && !error && total > 0 && (
        <>
          <p className="hint">
            {isSample
              ? `共 ${total} 笔样例订单；点击订单进入详情，可查看预约时间、菜品份数、用餐方式与下一步按钮位置。`
              : `档口共 ${total} 笔订单，本页 ${orders.length} 笔；点击查看详情。`}
          </p>
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

      {isSample && (
        <button
          type="button"
          className="merchant-order-list__setup"
          onClick={onOpenSetup}
          data-open-onboarding
        >
          商家注册 / 开店
        </button>
      )}
    </div>
  );
}