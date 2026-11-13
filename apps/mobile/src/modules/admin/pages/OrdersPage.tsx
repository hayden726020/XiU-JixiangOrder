import type { Order } from '../types';
import {
  diningModeText,
  exceptionText,
  formatDateTime,
  formatFen,
  formatTime,
  itemQuantity,
  orderStatusText,
} from '../utils/display';

interface OrdersPageProps {
  orders: Order[];
}

export default function OrdersPage({ orders }: OrdersPageProps) {
  return (
    <div className="admin-section">
      <h3>订单与异常查询</h3>
      <p className="admin-muted">
        样例只读列表，共 {orders.length} 笔。筛选与详情页在 S2 接入；本页不显示取餐码，也不提供订单状态操作。
      </p>

      {orders.length === 0 ? (
        <p className="notice">当前条件下没有订单。样例模式可切回默认列表。</p>
      ) : (
        <ul className="admin-order-list">
          {orders.map((order) => {
            const exception = exceptionText(order);
            return (
              <li key={order.id} className="admin-order">
                <div className="admin-order__head">
                  <code className="admin-order__id">{order.id}</code>
                  <span className={`admin-tag admin-tag--${order.status.toLowerCase()}`}>
                    {orderStatusText[order.status]}
                  </span>
                </div>
                <div className="admin-order__meta">
                  <span>
                    <strong>{order.stallName}</strong> · {formatTime(order.slotStart)}—
                    {formatTime(order.slotEnd)}
                  </span>
                  <span>
                    {diningModeText[order.diningMode]} · {itemQuantity(order)} 份 ·{' '}
                    {formatFen(order.totalFen)}
                  </span>
                  <span>
                    创建 {formatDateTime(order.createdAt)} · version {order.version}
                  </span>
                </div>
                {exception ? <p className="admin-order__exception">{exception}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="hint">
        真实查询将使用 <code>GET /admin/orders</code>，筛选参数、分页和字段过滤仍待写入契约；未确认前不接真实数据。
      </p>
    </div>
  );
}