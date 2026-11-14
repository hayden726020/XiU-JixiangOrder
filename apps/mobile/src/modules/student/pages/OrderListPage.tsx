import { useEffect, useState } from 'react';
import type { SourceError, StudentOrder, StudentSource } from '../types';
import { toSourceError } from '../types';
import { deriveOrderListView, toOrderListErrorView } from '../utils/orderListView';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import LoginGuide from '../components/LoginGuide';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';

type ListStatus = 'loading' | 'empty' | 'ready' | 'error';

export interface OrderListPageProps {
  source: StudentSource;
  onBack: () => void;
  backLabel?: string;
  onOpenOrder: (id: string) => void;
}

export default function OrderListPage({
  source,
  onBack,
  backLabel = '← 返回菜单',
  onOpenOrder,
}: OrderListPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [error, setError] = useState<SourceError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const realLoggedOut = source.mode === 'real' && !gate.usable;

  useEffect(() => {
    if (realLoggedOut) {
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);
    source.listOrders().then(
      (data) => {
        if (cancelled) {
          return;
        }
        setOrders(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      },
      (failure: unknown) => {
        if (cancelled) {
          return;
        }
        setOrders([]);
        setError(toSourceError(failure));
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, realLoggedOut, reloadToken]);

  const listView = deriveOrderListView(orders, source.mode);
  const errorView = toOrderListErrorView(error);

  if (realLoggedOut) {
    return (
      <section className="student-page" aria-labelledby="student-order-list-title">
        {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}
        <button type="button" className="student-secondary student-back" onClick={onBack}>
          {backLabel}
        </button>
        <header className="student-page__head">
          <p className="student-kicker">真实模式 · 只读订单列表</p>
          <h2 id="student-order-list-title">我的订单</h2>
        </header>
        <LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} />
      </section>
    );
  }

  return (
    <section className="student-page" aria-labelledby="student-order-list-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}
      <button type="button" className="student-secondary student-back" onClick={onBack}>
        {backLabel}
      </button>

      <header className="student-page__head">
        <p className="student-kicker">真实模式 · 只读订单列表</p>
        <h2 id="student-order-list-title">我的订单</h2>
        <p className="student-page__lead">
          订单来自公共服务；状态与取餐码请进入详情查看。
        </p>
      </header>

      {status === 'loading' ? <p className="student-loading">正在读取订单…</p> : null}

      {status === 'error' && errorView ? (
        <div className="student-error" role="alert">
          <p>{errorView.message}</p>
          <div className="student-error__actions">
            {errorView.action === 'login' ? (
              <>
                <button
                  type="button"
                  className="student-primary"
                  onClick={() => {
                    window.location.hash = '/system-check';
                  }}
                >
                  去公共入口登录
                </button>
                <button type="button" className="student-secondary" onClick={onBack}>
                  返回菜单
                </button>
              </>
            ) : (
              <button
                type="button"
                className="student-secondary"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                重新读取
              </button>
            )}
          </div>
        </div>
      ) : null}

      {status === 'empty' ? (
        <div className="student-empty" role="status">
          <p>{listView.emptyText}</p>
          <button type="button" className="student-secondary" onClick={onBack}>
            返回菜单去点餐
          </button>
        </div>
      ) : null}

      {status === 'ready' ? (
        <>
          <p className="student-order-list__count">{listView.countText}</p>
          <ul className="student-order-list" aria-label="我的订单列表">
            {listView.cards.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="student-order-list__item"
                  onClick={() => onOpenOrder(card.id)}
                >
                  <span className="student-order-list__head">
                    <span
                      className={`student-status-badge${card.cancelled ? ' is-cancelled' : ''}`}
                    >
                      {card.statusLabel}
                    </span>
                    <span className="student-order-list__total">{card.totalText}</span>
                  </span>
                  <span className="student-order-list__id">订单号 {card.id}</span>
                  {card.cancelBadge ? (
                    <span className="student-order-list__cancel-badge">{card.cancelBadge}</span>
                  ) : null}
                  {card.shopText ? (
                    <span className="student-order-list__shop">{card.shopText}</span>
                  ) : null}
                  <span className="student-order-list__dish">{card.dishSummary}</span>
                  <span className="student-order-list__meta">
                    {card.diningModeText} · {card.slotRangeText || '时段未提供'} ·{' '}
                    {card.createdText || '创建时间未提供'}
                  </span>
                  <span className="student-order-list__action">查看订单</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}