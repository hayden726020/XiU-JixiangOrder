import type { MerchantOrder, MerchantProfile, OrderStatus, SlotDay } from '../data/types';
import { itemsSummary, totalQuantity } from '../utils/money';
import { formatSlot, orderNoLabel, statusView } from '../state/orderView';

interface HomePageProps {
  mode: 'sample' | 'real';
  statDate: string;
  profile: MerchantProfile | null;
  merchantDisplayName?: string | null;
  orders: MerchantOrder[];
  slots: SlotDay | null;
  loading: boolean;
  onOpenOrders: (groupKey: string) => void;
  onOpenOrder: (id: string) => void;
  onOpenMenu: () => void;
}

function slotClock(value: string): string {
  const matched = value.match(/T(\d{2}:\d{2})/);
  return matched ? matched[1] : value;
}

function orderDay(order: MerchantOrder): string {
  const matched = order.slotStart.match(/^(\d{4}-\d{2}-\d{2})/);
  return matched ? matched[1] : order.createdAt.slice(0, 10);
}

function formatDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function money(fen: number): string {
  return (fen / 100).toFixed(2);
}

const PENDING_STATUSES: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING', 'READY'];

function bySlot(left: MerchantOrder, right: MerchantOrder): number {
  const slotOrder = left.slotStart.localeCompare(right.slotStart);
  return slotOrder !== 0 ? slotOrder : left.createdAt.localeCompare(right.createdAt);
}

export default function HomePage({
  mode,
  statDate,
  profile,
  merchantDisplayName,
  orders,
  slots,
  loading,
  onOpenOrders,
  onOpenOrder,
  onOpenMenu,
}: HomePageProps) {
  const todayOrders = orders.filter((order) => orderDay(order) === statDate);
  const activeOrders = todayOrders.filter((order) => order.status !== 'CANCELLED');
  const pending = todayOrders.filter((order) => order.status === 'NEW').length;
  const making = todayOrders.filter((order) => order.status === 'ACCEPTED' || order.status === 'PREPARING').length;
  const ready = todayOrders.filter((order) => order.status === 'READY').length;
  const completed = todayOrders.filter((order) => order.status === 'COMPLETED').length;
  const cancelled = todayOrders.filter((order) => order.status === 'CANCELLED').length;
  const inProgress = todayOrders.length - completed - cancelled;
  const turnoverFen = activeOrders.reduce((sum, order) => sum + order.totalFen, 0);
  const completionRate = todayOrders.length ? Math.round((completed / todayOrders.length) * 100) : 0;
  const openSlots = (slots?.slots ?? []).filter((slot) => slot.enabled);
  const isOpen = openSlots.length > 0;
  const hours = openSlots.length > 0
    ? `${slotClock(openSlots[0].slotStart)}—${slotClock(openSlots[openSlots.length - 1].slotEnd)}`
    : '未设置营业时段';
  const shopName = profile?.shop?.name
    ?? merchantDisplayName
    ?? profile?.merchant?.name
    ?? '我的档口';
  const dateLabel = mode === 'sample' ? `演示日 ${formatDate(statDate)} · 样例数据` : formatDate(statDate);

  const orderCountByClock = new Map<string, number>();
  for (const order of todayOrders) {
    const label = slotClock(order.slotStart);
    orderCountByClock.set(label, (orderCountByClock.get(label) ?? 0) + 1);
  }
  const slotTrend = (slots?.slots ?? []).map((slot) => ({
    key: slot.slotId,
    label: slotClock(slot.slotStart),
    endLabel: slotClock(slot.slotEnd),
    count: orderCountByClock.get(slotClock(slot.slotStart)) ?? 0,
    enabled: slot.enabled,
  }));
  const fallbackTrend = [...orderCountByClock.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ key: label, label, endLabel: '', count, enabled: true }));
  const trend = slotTrend.length > 0 ? slotTrend : fallbackTrend;
  const maxTrend = Math.max(1, ...trend.map((item) => item.count));
  const metric = (value: number) => (loading ? '—' : String(value));

  const earliest = (statuses: OrderStatus[]): string => {
    const first = todayOrders
      .filter((order) => statuses.includes(order.status))
      .sort(bySlot)[0];
    return first ? slotClock(first.slotStart) : '暂无';
  };

  const pendingOrders = todayOrders
    .filter((order) => PENDING_STATUSES.includes(order.status))
    .sort(bySlot)
    .slice(0, 3);

  return (
    <div className="merchant-home" data-merchant-home>
      <section className="merchant-home__hero" aria-labelledby="merchant-home-title">
        <div className="merchant-home__hero-copy">
          <span className="merchant-home__brand">食麦呼 · 档口工作台</span>
          <h2 id="merchant-home-title">{shopName}</h2>
          <p>{dateLabel}</p>
        </div>
        <div className="merchant-home__hero-side">
          <span className={isOpen ? 'merchant-home__status is-open' : 'merchant-home__status'}>
            <i />
            {isOpen ? '营业中' : '休息中'}
          </span>
          <small>今天 {hours}</small>
        </div>
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-primary">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-primary">待处理事项</h3>
          <span>点击直接进入对应订单</span>
        </header>
        <div className="merchant-home__primary-stats">
          <button
            type="button"
            className="merchant-home__primary-stat merchant-home__primary-stat--new"
            onClick={() => onOpenOrders('new')}
            data-home-stat="new"
          >
            <span>待接单</span>
            <strong>{metric(pending)}</strong>
            <small>{loading ? '读取中' : `最早 ${earliest(['NEW'])}`}</small>
          </button>
          <button
            type="button"
            className="merchant-home__primary-stat"
            onClick={() => onOpenOrders('in-progress')}
            data-home-stat="in-progress"
          >
            <span>制作中</span>
            <strong>{metric(making)}</strong>
            <small>{loading ? '读取中' : `最早 ${earliest(['ACCEPTED', 'PREPARING'])}`}</small>
          </button>
          <button
            type="button"
            className="merchant-home__primary-stat"
            onClick={() => onOpenOrders('ready')}
            data-home-stat="ready"
          >
            <span>待取餐</span>
            <strong>{metric(ready)}</strong>
            <small>{loading ? '读取中' : `最早 ${earliest(['READY'])}`}</small>
          </button>
        </div>
        <div className="merchant-home__pending-list">
          {pendingOrders.length === 0 ? (
            <p className="merchant-home__pending-empty">当前没有待处理订单。</p>
          ) : (
            pendingOrders.map((order) => (
              <button
                type="button"
                className="merchant-home__pending-row"
                key={order.id}
                onClick={() => onOpenOrder(order.id)}
              >
                <span className="merchant-home__pending-head">
                  <b>{orderNoLabel(order)}</b>
                  <span>{statusView(order.status).label}</span>
                  <span>{formatSlot(order)}</span>
                </span>
                <span className="merchant-home__pending-body">
                  <span>{itemsSummary(order.items)}</span>
                  <span>共 {totalQuantity(order.items)} 份</span>
                  {order.remark && <em>备注：{order.remark}</em>}
                </span>
                <span className="merchant-home__pending-arrow">→</span>
              </button>
            ))
          )}
        </div>
        <div className="merchant-home__secondary-stats">
          <span>今日订单 <b>{metric(todayOrders.length)}</b></span>
          <span>营业额 <b>{loading ? '—' : `¥${money(turnoverFen)}`}</b></span>
          <span>完成率 <b>{loading ? '—' : `${completionRate}%`}</b></span>
        </div>
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-overview">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-overview">今日经营概览</h3>
          <span>取餐高峰 · 峰值 {maxTrend} 单</span>
        </header>
        <div className="merchant-home__overview">
          <div className="merchant-home__trend-block">
            <p className="merchant-home__trend-caption">
              各预约时段订单数
              <span>{todayOrders.length} 单</span>
            </p>
            {trend.length === 0 ? (
              <p className="merchant-home__trend-empty">今天还没有订单</p>
            ) : (
              <div className="merchant-home__trend" role="img" aria-label="各预约时段订单数">
                {trend.map((item) => (
                  <div
                    className={item.enabled ? 'merchant-home__trend-col' : 'merchant-home__trend-col is-off'}
                    key={item.key}
                  >
                    <b>{item.count}</b>
                    <span className="merchant-home__trend-track">
                      <span
                        className="merchant-home__trend-bar"
                        style={{ height: `${item.count === 0 ? 4 : Math.max(12, Math.round((item.count / maxTrend) * 38))}px` }}
                      />
                    </span>
                    <small>
                      {item.label}
                      {item.endLabel ? `—${item.endLabel}` : ''}
                    </small>
                    {!item.enabled && <em>休息</em>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="merchant-home__peak-summary">
            <span>已完成 <b>{completed}</b></span>
            <span>进行中 <b>{inProgress}</b></span>
            <span>已取消 <b>{cancelled}</b></span>
          </div>
        </div>
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-tools">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-tools">快捷操作</h3>
        </header>
        <div className="merchant-home__tools">
          <button type="button" className="merchant-home__tool" onClick={onOpenMenu}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v14H4zM8 5v14M4 10h16" />
            </svg>
            <span>菜品管理</span>
          </button>
          <button type="button" className="merchant-home__tool" onClick={onOpenMenu}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h12M12 6l6 6-6 6M20 4v16" />
            </svg>
            <span>制作今日菜单</span>
          </button>
          <button type="button" className="merchant-home__tool" onClick={onOpenMenu}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>营业时段</span>
          </button>
        </div>
      </section>
    </div>
  );
}