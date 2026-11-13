import OrderRow from '../components/OrderRow';
import { DEMO_SCENARIOS } from '../data/sampleData';
import type { MerchantOrder, MerchantScenario } from '../data/types';
import { groupOrders } from '../state/orderView';

interface OrderListPageProps {
  orders: MerchantOrder[];
  scenario: MerchantScenario;
  isSample: boolean;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  onScenarioChange: (scenario: MerchantScenario) => void;
  onPageChange: (page: number) => void;
  onOpenOrder: (id: string) => void;
  onOpenMenu: () => void;
}

export default function OrderListPage({
  orders,
  scenario,
  isSample,
  loading,
  error,
  page,
  pageSize,
  total,
  onScenarioChange,
  onPageChange,
  onOpenOrder,
  onOpenMenu,
}: OrderListPageProps) {
  const groups = groupOrders(orders);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="merchant-view">
      <header className="merchant-view__header">
        <div>
          <h2>
            订单列表
            {isSample && <span className="merchant-readonly-tag">样例 · demo=true</span>}
          </h2>
          <p className="lead">
            {isSample
              ? '样例数据；按状态分组，堂食/外带与待处理取消申请一眼可见。'
              : '真实数据；按状态分组，只读展示。写操作尚未接入。'}
          </p>
        </div>
        <button type="button" className="merchant-link-button" onClick={onOpenMenu}>
          菜单与库存
        </button>
      </header>

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
                <OrderRow key={order.id} order={order} onOpen={onOpenOrder} />
              ))}
            </div>
          </section>
        ))
      )}

      {!loading && !error && total > 0 && (
        <>
          <p className="hint">
            {isSample
              ? `共 ${total} 笔样例订单，其中本页已取消 ${orders.filter((order) => order.status === 'CANCELLED').length} 笔；已取消订单保留在列表，点击可查看取消原因与模拟退款标记。`
              : `档口共 ${total} 笔订单，本页 ${orders.length} 笔；点击查看详情。`}
          </p>
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
        </>
      )}
    </div>
  );
}