import { useEffect, useMemo, useState } from 'react';
import type { SourceError, StudentOrder, StudentSource } from '../types';
import { toSourceError } from '../types';
import { toOrderListErrorView } from '../utils/orderListView';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import LoginGuide from '../components/LoginGuide';
import OrderMenuIcon from '../components/OrderMenuIcons';
import OrderListIcon from '../components/OrderListIcons';
import OrderTicketCard from '../components/OrderTicketCard';
import '../order-list-new.css';

type ListStatus = 'loading' | 'empty' | 'ready' | 'error';
type OrderFilter = 'all' | 'progress' | 'completed' | 'after';

export interface OrderListPageProps {
  source: StudentSource;
  onBack: () => void;
  backLabel?: string;
  onOpenOrder: (id: string) => void;
  onGoToHome?: () => void;
  onGoToShop?: () => void;
  onGoToProfile?: () => void;
}

function inFilter(order: StudentOrder, filter: OrderFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'progress') return order.status === 'NEW' || order.status === 'ACCEPTED' || order.status === 'PREPARING' || order.status === 'READY';
  if (filter === 'completed') return order.status === 'COMPLETED';
  return order.status === 'CANCELLED' || order.paymentStatus === 'SIMULATED_REFUNDED' || order.cancelRequest.status === 'PENDING';
}

export default function OrderListPage({ source, onBack, onOpenOrder, onGoToHome, onGoToShop, onGoToProfile }: OrderListPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [error, setError] = useState<SourceError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const realLoggedOut = source.mode === 'real' && !gate.usable;

  useEffect(() => {
    if (realLoggedOut) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    source.listOrders().then(
      (data) => {
        if (cancelled) return;
        setOrders(data);
        setStatus(data.length ? 'ready' : 'empty');
      },
      (failure: unknown) => {
        if (cancelled) return;
        setOrders([]);
        setError(toSourceError(failure));
        setStatus('error');
      },
    );
    return () => { cancelled = true; };
  }, [source, realLoggedOut, reloadToken]);

  const visibleOrders = useMemo(() => orders
    .filter((order) => inFilter(order, filter))
    .filter((order) => {
      const q = query.trim().toLocaleLowerCase();
      return !q || [order.id, order.merchantName ?? '', ...order.items.map((item) => item.name)]
        .some((value) => value.toLocaleLowerCase().includes(q));
    }), [orders, filter, query]);
  const progressCount = orders.filter((order) => inFilter(order, 'progress')).length;
  const errorView = toOrderListErrorView(error);
  const filters: { id: OrderFilter; label: string; icon: 'clipboard' | 'clock' | 'checkSquare' | 'refund' }[] = [
    { id: 'all', label: '全部订单', icon: 'clipboard' },
    { id: 'progress', label: `进行中 (${progressCount})`, icon: 'clock' },
    { id: 'completed', label: '已完成', icon: 'checkSquare' },
    { id: 'after', label: '退款/售后', icon: 'refund' },
  ];

  return <section className="meal-orders" aria-labelledby="meal-orders-title">
    <div className="meal-orders__main">
      <header className="meal-orders__header">
        <div className="meal-orders__title-wrap"><h1 id="meal-orders-title">我的订单</h1><span className="meal-orders__spark" aria-hidden="true">✳</span></div>
        <div className="meal-orders__header-actions">
          <button type="button" aria-label="搜索订单" aria-expanded={searchOpen} onClick={() => setSearchOpen((value) => !value)}><OrderListIcon name="search" size={27} /></button>
          <button type="button" aria-label="订单帮助" onClick={() => setNotice('订单问题可打开订单详情查看状态；如需联系档口，请凭订单号到对应档口咨询。')}><OrderListIcon name="headset" size={29} /></button>
        </div>
      </header>
      <p className="meal-orders__sample">{source.mode === 'sample' ? '示例订单 · 餐品图片仅供参考' : '餐品图片仅供参考'}</p>
      {searchOpen ? <div className="meal-orders__search"><OrderListIcon name="search" size={20} /><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索订单号、档口或餐品" aria-label="搜索订单号、档口或餐品" /><button type="button" aria-label="关闭搜索" onClick={() => { setSearchOpen(false); setQuery(''); }}><OrderListIcon name="close" size={18} /></button></div> : null}
      <div className="meal-orders__filters" role="group" aria-label="筛选订单">
        {filters.map((item) => <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}><OrderListIcon name={item.icon} size={21} /><span>{item.label}</span></button>)}
      </div>
      {realLoggedOut ? <div className="meal-orders__state"><LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} /></div> : null}
      {!realLoggedOut && status === 'loading' ? <p className="meal-orders__state" role="status">正在读取订单…</p> : null}
      {!realLoggedOut && status === 'error' && errorView ? <div className="meal-orders__state meal-orders__state--error" role="alert"><p>{errorView.message}</p>{errorView.action === 'login' ? <button type="button" onClick={() => { window.location.hash = '/system-check'; }}>去公共入口登录</button> : <button type="button" onClick={() => setReloadToken((value) => value + 1)}>重新读取</button>}</div> : null}
      {!realLoggedOut && status === 'empty' ? <div className="meal-orders__state"><p>还没有订单，去挑一份喜欢的餐吧。</p><button type="button" onClick={onGoToShop || onBack}>去点餐</button></div> : null}
      {!realLoggedOut && status === 'ready' ? <main className="meal-orders__cards" aria-label="订单列表">{visibleOrders.length ? visibleOrders.map((order) => <OrderTicketCard key={order.id} order={order} mode={source.mode} onOpenOrder={onOpenOrder} onAskMerchant={(kind, selected) => setNotice(kind === 'remind' ? `暂无在线催单服务。请凭订单号 ${selected.id} 到 ${selected.merchantName || '档口'} 咨询。` : `请凭订单号 ${selected.id} 到 ${selected.merchantName || '档口'} 联系商家。`)} />) : <div className="meal-orders__state">没有符合条件的订单</div>}</main> : null}
    </div>
    <nav className="meal-orders__nav" aria-label="学生端导航">
      <button type="button" onClick={onGoToHome || onGoToShop || onBack}><OrderMenuIcon name="home" size={27} /><span>首页</span></button>
      <button type="button" onClick={onGoToShop || onBack}><OrderMenuIcon name="bowl" size={27} /><span>点餐</span></button>
      <button type="button" className="is-active" aria-current="page"><OrderMenuIcon name="receipt" size={27} /><span>订单</span></button>
      <button type="button" onClick={onGoToProfile || onBack}><OrderMenuIcon name="user" size={27} /><span>我的</span></button>
    </nav>
    {notice ? <div className="meal-orders__notice-backdrop" onClick={() => setNotice('')}><div className="meal-orders__notice" role="dialog" aria-modal="true" aria-label="订单提示" onClick={(event) => event.stopPropagation()}><p>{notice}</p><button type="button" onClick={() => setNotice('')}>我知道了</button></div></div> : null}
  </section>;
}
