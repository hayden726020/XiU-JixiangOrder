import { useEffect, useMemo, useState } from 'react';
import type { SourceError, StudentOrder, StudentSource } from '../types';
import { toSourceError } from '../types';
import { toOrderListErrorView } from '../utils/orderListView';
import { orderNoText } from '../utils/orderStatusView';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import { getCachedOrders, setCachedOrders } from '../state/studentDataCache';
import LoginGuide from '../components/LoginGuide';
import OrderListIcon from '../components/OrderListIcons';
import OrderTicketCard from '../components/OrderTicketCard';
import StudentTabBar from '../components/StudentTabBar';
import '../order-list-new.css';

type ListStatus = 'loading' | 'empty' | 'ready' | 'error';
export type OrderFilter = 'all' | 'progress' | 'completed' | 'after' | 'new' | 'preparing' | 'ready';

export interface OrderListPageProps {
  source: StudentSource;
  onBack: (trigger?: HTMLElement | null) => void;
  backLabel?: string;
  initialFilter?: OrderFilter;
  onOpenOrder: (id: string, trigger?: HTMLElement | null) => void;
  onGoToHome?: (trigger?: HTMLElement | null) => void;
  onGoToShop?: (trigger?: HTMLElement | null) => void;
  onGoToProfile?: (trigger?: HTMLElement | null) => void;
}

function inFilter(order: StudentOrder, filter: OrderFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'progress') return order.status === 'NEW' || order.status === 'ACCEPTED' || order.status === 'PREPARING' || order.status === 'READY';
  if (filter === 'completed') return order.status === 'COMPLETED';
  if (filter === 'new') return order.status === 'NEW';
  if (filter === 'preparing') return order.status === 'ACCEPTED' || order.status === 'PREPARING';
  if (filter === 'ready') return order.status === 'READY';
  return order.status === 'CANCELLED' || order.paymentStatus === 'SIMULATED_REFUNDED' || order.cancelRequest.status === 'PENDING';
}

function tabIndexForFilter(filter: OrderFilter): number {
  if (filter === 'all') return 0;
  if (filter === 'progress' || filter === 'new' || filter === 'preparing' || filter === 'ready') return 1;
  if (filter === 'completed') return 2;
  return 3;
}

export default function OrderListPage({
  source,
  onBack,
  initialFilter = 'all',
  onOpenOrder,
  onGoToHome,
  onGoToShop,
  onGoToProfile,
}: OrderListPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const realLoggedOut = source.mode === 'real' && !gate.usable;
  const initialOrders = !realLoggedOut ? getCachedOrders(source) : null;
  const [orders, setOrders] = useState<StudentOrder[]>(() => initialOrders ?? []);
  const [status, setStatus] = useState<ListStatus>(() =>
    initialOrders ? (initialOrders.length ? 'ready' : 'empty') : 'loading',
  );
  const [error, setError] = useState<SourceError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [filterAnimDir, setFilterAnimDir] = useState<'none' | 'forward' | 'backward'>('none');
  const [squishParity, setSquishParity] = useState<0 | 1>(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setFilter(initialFilter);
    setFilterAnimDir('none');
  }, [initialFilter]);

  useEffect(() => {
    if (realLoggedOut) return;
    let cancelled = false;
    const cached = getCachedOrders(source);
    if (cached && reloadToken === 0) {
      setOrders(cached);
      setStatus(cached.length ? 'ready' : 'empty');
    } else {
      setStatus('loading');
    }
    setError(null);
    source.listOrders().then(
      (data) => {
        if (cancelled) return;
        setCachedOrders(source, data);
        setOrders(data);
        setStatus(data.length ? 'ready' : 'empty');
      },
      (failure: unknown) => {
        if (cancelled) return;
        if (getCachedOrders(source) === null || reloadToken > 0) {
          setOrders([]);
          setError(toSourceError(failure));
          setStatus('error');
        }
      },
    );
    return () => { cancelled = true; };
  }, [source, realLoggedOut, reloadToken]);

  const visibleOrders = useMemo(() => orders
    .filter((order) => inFilter(order, filter))
    .filter((order) => {
      const q = query.trim().toLocaleLowerCase();
      return !q || [order.id, String(order.orderNo ?? ''), order.merchantName ?? '', ...order.items.map((item) => item.name)]
        .some((value) => value.toLocaleLowerCase().includes(q));
    }), [orders, filter, query]);
  const progressCount = orders.filter((order) => inFilter(order, 'progress')).length;
  const errorView = toOrderListErrorView(error);
  const activeFilterIndex = tabIndexForFilter(filter);
  const filters: { id: 'all' | 'progress' | 'completed' | 'after'; label: string; icon: 'clipboard' | 'clock' | 'checkSquare' | 'refund' }[] = [
    { id: 'all', label: '全部订单', icon: 'clipboard' },
    { id: 'progress', label: `进行中 (${progressCount})`, icon: 'clock' },
    { id: 'completed', label: '已完成', icon: 'checkSquare' },
    { id: 'after', label: '退款/售后', icon: 'refund' },
  ];

  function handleSelectFilter(nextId: 'all' | 'progress' | 'completed' | 'after', nextIndex: number) {
    if (nextId === filter && nextIndex === activeFilterIndex) return;
    if (nextIndex !== activeFilterIndex) {
      setFilterAnimDir(nextIndex > activeFilterIndex ? 'forward' : 'backward');
      setSquishParity((p) => (p === 0 ? 1 : 0));
    }
    setFilter(nextId);
  }

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
      <div
        className="meal-orders__filters meal-orders__filters--elastic"
        role="group"
        aria-label="筛选订单"
        data-active-index={activeFilterIndex}
        data-anim-dir={filterAnimDir}
        data-squish={squishParity}
      >
        <span className="meal-orders__filters-thumb" aria-hidden="true" />
        {filters.map((item, index) => {
          const isActive = activeFilterIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? 'is-active' : ''}
              aria-pressed={isActive}
              onClick={() => handleSelectFilter(item.id, index)}
            >
              <OrderListIcon name={item.icon} size={21} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {realLoggedOut ? <div className="meal-orders__state"><LoginGuide gate={gate} onRecheck={refresh} onBack={() => onBack()} /></div> : null}
      {!realLoggedOut && status === 'loading' ? <p className="meal-orders__state" role="status">正在读取订单…</p> : null}
      {!realLoggedOut && status === 'error' && errorView ? <div className="meal-orders__state meal-orders__state--error" role="alert"><p>{errorView.message}</p>{errorView.action === 'login' ? <button type="button" onClick={() => { window.location.hash = '/system-check'; }}>去公共入口登录</button> : <button type="button" onClick={() => setReloadToken((value) => value + 1)}>重新读取</button>}</div> : null}
      {!realLoggedOut && status === 'empty' ? <div className="meal-orders__state"><p>还没有订单，去挑一份喜欢的餐吧。</p><button type="button" onClick={(event) => (onGoToShop || onBack)(event.currentTarget)}>去点餐</button></div> : null}
      {!realLoggedOut && status === 'ready' ? <main className="meal-orders__cards" aria-label="订单列表">{visibleOrders.length ? visibleOrders.map((order, index) => <OrderTicketCard key={order.id} index={index} order={order} mode={source.mode} onOpenOrder={onOpenOrder} onAskMerchant={(kind, selected) => setNotice(kind === 'remind' ? `暂无在线催单服务。请凭订单号 ${orderNoText(selected)} 到 ${selected.merchantName || '档口'} 咨询。` : `请凭订单号 ${orderNoText(selected)} 到 ${selected.merchantName || '档口'} 联系商家。`)} />) : <div className="meal-orders__state">没有符合条件的订单</div>}</main> : null}
    </div>
    <StudentTabBar
      active="orders"
      placement="fixed"
      onSelect={(tab, button) => {
        if (tab === 'home') {
          (onGoToHome || onGoToShop || onBack)(button);
        } else if (tab === 'order') {
          (onGoToShop || onBack)(button);
        } else if (tab === 'profile') {
          (onGoToProfile || onBack)(button);
        }
      }}
    />
    {notice ? <div className="meal-orders__notice-backdrop" onClick={() => setNotice('')}><div className="meal-orders__notice" role="dialog" aria-modal="true" aria-label="订单提示" onClick={(event) => event.stopPropagation()}><p>{notice}</p><button type="button" onClick={() => setNotice('')}>我知道了</button></div></div> : null}
  </section>;
}
