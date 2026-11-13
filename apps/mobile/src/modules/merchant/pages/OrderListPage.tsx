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
  onScenarioChange: (scenario: MerchantScenario) => void;
  onOpenOrder: (id: string) => void;
  onOpenMenu: () => void;
}

export default function OrderListPage({
  orders,
  scenario,
  isSample,
  loading,
  error,
  onScenarioChange,
  onOpenOrder,
  onOpenMenu,
}: OrderListPageProps) {
  const groups = groupOrders(orders);

  return (
    <div className="merchant-view">
      <header className="merchant-view__header">
        <div>
          <h2>订单列表</h2>
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
          {isSample ? '暂无订单，样例模式下可切换演示场景。' : '服务返回 0 笔订单。'}
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

      <p className="hint">
        {isSample
          ? `共 ${orders.length} 笔样例订单；点击订单进入详情，可查看预约时间、菜品份数、用餐方式与下一步按钮位置。`
          : `服务共返回 ${orders.length} 笔订单；点击查看详情。`}
      </p>
    </div>
  );
}