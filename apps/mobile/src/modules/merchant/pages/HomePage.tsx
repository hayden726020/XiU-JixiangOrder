import type { MerchantOrder, MerchantProfile, SlotDay } from '../data/types';

function WheatMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 112V44" />
        <path d="M60 62c-10 0-17-6-19-15 10 0 17 5 19 15Z" />
        <path d="M60 62c10 0 17-6 19-15-10 0-17 5-19 15Z" />
        <path d="M60 78c-10 0-17-6-19-15 10 0 17 5 19 15Z" />
        <path d="M60 78c10 0 17-6 19-15-10 0-17 5-19 15Z" />
        <path d="M60 94c-10 0-17-6-19-15 10 0 17 5 19 15Z" />
        <path d="M60 94c10 0 17-6 19-15-10 0-17 5-19 15Z" />
        <path d="M60 44c-7-2-12-7-14-14 8 1 13 6 14 14Z" />
        <path d="M60 44c7-2 12-7 14-14-8 1-13 6-14 14Z" />
        <path d="M60 112c-7 0-13 2-19 6" />
        <path d="M60 112c7 0 13 2 19 6" />
      </g>
    </svg>
  );
}

interface HomePageProps {
  mode: 'sample' | 'real';
  statDate: string;
  profile: MerchantProfile | null;
  merchantDisplayName?: string | null;
  orders: MerchantOrder[];
  slots: SlotDay | null;
  loading: boolean;
  onOpenOrders: (groupKey: string) => void;
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

export default function HomePage({
  mode,
  statDate,
  profile,
  merchantDisplayName,
  orders,
  slots,
  loading,
  onOpenOrders,
  onOpenMenu,
}: HomePageProps) {
  const todayOrders = orders.filter((order) => orderDay(order) === statDate);
  const activeOrders = todayOrders.filter((order) => order.status !== 'CANCELLED');
  const pending = todayOrders.filter((order) => order.status === 'NEW').length;
  const making = todayOrders.filter((order) => order.status === 'ACCEPTED' || order.status === 'PREPARING').length;
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
    ?? profile?.merchant?.name
    ?? merchantDisplayName
    ?? '我的档口';

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
  const dateLabel = mode === 'sample' ? `演示日 ${formatDate(statDate)} · 样例数据` : `${formatDate(statDate)} · 真实数据`;

  return (
    <div className="merchant-home" data-merchant-home>
      <section className="merchant-home__hero" aria-labelledby="merchant-home-title">
        <div className="merchant-home__hero-copy">
          <span className="merchant-home__brand">
            <span className="merchant-home__brand-mark">食</span>
            食麦呼 · 档口端
          </span>
          <h2 id="merchant-home-title">欢迎使用食麦呼</h2>
          <p>用心做好每一餐，让美味准时送达</p>
        </div>
        <div className="merchant-home__hero-side">
          <strong>{shopName}</strong>
          <span className={isOpen ? 'merchant-home__status is-open' : 'merchant-home__status'}>
            <i />
            {isOpen ? '营业中' : '休息中'}
          </span>
          <small>今日 {hours}</small>
        </div>
        <WheatMark className="merchant-home__grain" />
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-metrics">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-metrics">今日经营数据</h3>
          <span>{dateLabel}</span>
        </header>
        <div className="merchant-home__metrics">
          <article className="merchant-home__metric">
            <span>今日订单</span>
            <strong>{metric(todayOrders.length)}</strong>
            <small>单</small>
          </article>
          <article className="merchant-home__metric merchant-home__metric--pending">
            <span>待接单</span>
            <strong>{metric(pending)}</strong>
            <small>单</small>
          </article>
          <article className="merchant-home__metric">
            <span>制作中</span>
            <strong>{metric(making)}</strong>
            <small>单</small>
          </article>
          <article className="merchant-home__metric merchant-home__metric--money">
            <span>今日营业额</span>
            <strong>{loading ? '—' : `¥${money(turnoverFen)}`}</strong>
            <small>已支付且未取消</small>
          </article>
        </div>
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-orders">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-orders">订单管理</h3>
          <span>按状态快速查看</span>
        </header>
        <div className="merchant-home__quick-grid">
          <button
            type="button"
            className="merchant-home__quick merchant-home__quick--pending"
            onClick={() => onOpenOrders('new')}
          >
            <span className="merchant-home__quick-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3h12l2 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" />
                <path d="M4 7h16M9 12h6" />
              </svg>
            </span>
            <strong>待接单订单</strong>
            <small><b>{pending}</b> 单待接</small>
            <i aria-hidden="true">→</i>
          </button>
          <button type="button" className="merchant-home__quick" onClick={() => onOpenOrders('in-progress')}>
            <span className="merchant-home__quick-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 11h14M7 11V7a5 5 0 0 1 10 0v4" />
                <path d="M4 11h16l-1.2 8.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8z" />
              </svg>
            </span>
            <strong>正在制作</strong>
            <small><b>{making}</b> 单进行中</small>
            <i aria-hidden="true">→</i>
          </button>
          <button type="button" className="merchant-home__quick" onClick={() => onOpenOrders('completed')}>
            <span className="merchant-home__quick-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l2.5 2.5L16 9.5" />
              </svg>
            </span>
            <strong>已完成订单</strong>
            <small><b>{completed}</b> 单已完成</small>
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-overview">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-overview">今日经营概览</h3>
          <span>完成率 {completionRate}%</span>
        </header>
        <div className="merchant-home__overview">
          <div className="merchant-home__trend-block">
            <p className="merchant-home__trend-caption">
              按营业时段统计订单笔数
              <span>{todayOrders.length} 单 · 峰值 {maxTrend} 单</span>
            </p>
            {trend.length === 0 ? (
              <p className="merchant-home__trend-empty">今天还没有订单</p>
            ) : (
              <div className="merchant-home__trend" role="img" aria-label="按时段订单分布">
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
          <div className="merchant-home__progress">
            <div className="merchant-home__progress-head">
              <span>订单完成情况</span>

            </div>
            <div className="merchant-home__progress-track">
              <span style={{ width: `${completionRate}%` }} />
            </div>
            <ul className="merchant-home__progress-legend">
              <li><i className="is-done" />已完成 {completed}</li>
              <li><i className="is-active" />进行中 {inProgress}</li>
              <li><i className="is-off" />已取消 {cancelled}</li>
            </ul>
            <p className="merchant-home__progress-note">
              {todayOrders.length === 0 ? '暂无订单，数据会随新订单自动更新。' : '数据来自今日订单列表，与订单管理使用同一数据源。'}
            </p>
          </div>
        </div>
      </section>

      <section className="merchant-home__section" aria-labelledby="merchant-home-tools">
        <header className="merchant-home__section-head">
          <h3 id="merchant-home-tools">常用功能</h3>
          <span>日常经营入口</span>
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
            <span>今日菜单</span>
          </button>
          <button type="button" className="merchant-home__tool" onClick={() => onOpenOrders('new')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
            </svg>
            <span>订单管理</span>
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

      <section className="merchant-home__tip" aria-label="温馨提示">
        <div className="merchant-home__tip-copy">
          <span>温馨提示</span>
          <strong>每一份用心，都值得被期待。</strong>
          <p>请及时处理新订单，避免学生久等。</p>
        </div>
        <WheatMark className="merchant-home__tip-grain" />
      </section>
    </div>
  );
}