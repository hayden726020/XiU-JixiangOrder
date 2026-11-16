import { useEffect, useState } from 'react';
import type { SourceError, StudentOrder, StudentSource } from '../types';
import { toSourceError } from '../types';
import { deriveOrderListView, toOrderListErrorView } from '../utils/orderListView';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import LoginGuide from '../components/LoginGuide';
import SampleBanner from '../components/SampleBanner';

import orderHeaderBanner from '../assets/order-header-banner.png';
import cardPolaroidFengwei from '../assets/card-polaroid-fengwei.png';
import cardPolaroidMianshi from '../assets/card-polaroid-mianshi.png';
import cardPolaroidDazhong from '../assets/card-polaroid-dazhong.png';
import '../order-list.css';

type ListStatus = 'loading' | 'empty' | 'ready' | 'error';

export interface OrderListPageProps {
  source: StudentSource;
  onBack: () => void;
  backLabel?: string;
  onOpenOrder: (id: string) => void;
  onGoToHome?: () => void;
  onGoToShop?: () => void;
  onGoToProfile?: () => void;
}

/* 刀叉图标 */
function ForkKnifeIcon() {
  return (
    <svg className="order-card__meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
      <path d="M15 11v11" />
      <path d="M5 2v8a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V2" />
      <path d="M8 13v9" />
    </svg>
  );
}

/* 打包袋图标 */
function ShoppingBagIcon() {
  return (
    <svg className="order-card__meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export default function OrderListPage({
  source,
  onBack,
  backLabel = '← 返回',
  onOpenOrder,
  onGoToHome,
  onGoToShop,
  onGoToProfile,
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

  function getCardPolaroidImg(key: string) {
    if (key === 'fengwei') return cardPolaroidFengwei;
    if (key === 'mianshi') return cardPolaroidMianshi;
    return cardPolaroidDazhong;
  }

  if (realLoggedOut) {
    return (
      <section className="student-order-list-page" aria-labelledby="student-order-list-title">
        {source.mode === 'sample' ? <SampleBanner /> : null}
        <header className="order-list-header-banner-wrap">
          <img
            className="order-list-header-banner"
            src={orderHeaderBanner}
            alt="我的订单"
          />
        </header>
        <div style={{ padding: '1rem', position: 'relative', zIndex: 10 }}>
          <button type="button" className="student-secondary student-back" onClick={onBack}>
            {backLabel}
          </button>
          <header style={{ margin: '1rem 0' }}>
            <h2 id="student-order-list-title" className="order-card__shop-name">我的订单</h2>
          </header>
          <LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} />
        </div>
        <nav className="student-tabbar" aria-label="底部导航">
          <button type="button" className="student-tab-item" onClick={onGoToHome || onGoToShop}><span>首页</span></button>
          <button type="button" className="student-tab-item" onClick={onGoToShop}><span>点餐</span></button>
          <button type="button" className="student-tab-item is-active" aria-current="page"><span>订单</span></button>
          <button type="button" className="student-tab-item" onClick={onGoToProfile}><span>我的</span></button>
        </nav>
      </section>
    );
  }

  return (
    <section className="student-order-list-page" aria-labelledby="student-order-list-title">
      {/* 顶部指示条 */}
      {source.mode === 'sample' ? <SampleBanner /> : null}

      {/* 顶部完整艺术手绘横幅：我的订单 · 每一餐都安排好了 · 记得准时取餐 */}
      <header className="order-list-header-banner-wrap">
        <img
          className="order-list-header-banner"
          src={orderHeaderBanner}
          alt="我的订单：每一餐，都安排好了。记得准时取餐"
        />
        <h1 id="student-order-list-title" className="sr-only">我的订单</h1>
      </header>

      {/* 加载与错误提示 */}
      <div style={{ padding: '0 1rem' }}>
        {status === 'loading' ? (
          <p className="student-loading" style={{ textAlign: 'center', margin: '2rem 0' }}>
            正在读取订单…
          </p>
        ) : null}

        {status === 'error' && errorView ? (
          <div className="student-error" role="alert" style={{ margin: '1rem 0' }}>
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
                    返回
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
          <div className="order-list-empty" role="status">
            <p>{listView.emptyText}</p>
            <button type="button" className="order-card__btn-primary" style={{ maxWidth: '200px', margin: '0 auto' }} onClick={onGoToShop || onBack}>
              去选店点餐
            </button>
          </div>
        ) : null}
      </div>

      {/* 订单卡片列表区 */}
      {status === 'ready' ? (
        <main className="order-list-cards" aria-label="订单列表">
          {listView.cards.map((card) => {
            const isReady = card.statusType === 'ready';
            const isPreparing = card.statusType === 'preparing';
            const isCompleted = card.statusType === 'completed';

            return (
              <article key={card.id} className="order-card">
                {/* 左侧：拍立得照片卡片 */}
                <div className="order-card__photo-frame">
                  <img
                    className="order-card__photo-img"
                    src={getCardPolaroidImg(card.polaroidKey)}
                    alt={card.shopName}
                  />
                </div>

                {/* 右侧：订单信息 */}
                <div className="order-card__info">
                  {/* 第一行：档口名与状态徽章 */}
                  <div className="order-card__row-head">
                    <h2 className="order-card__shop-name">{card.shopName}</h2>
                    <span
                      className={`order-status-capsule ${
                        isReady
                          ? 'is-ready'
                          : isPreparing
                          ? 'is-preparing'
                          : isCompleted
                          ? 'is-completed'
                          : ''
                      }`}
                    >
                      {card.statusLabel}
                    </span>
                  </div>

                  {/* 第二行：菜品与价格 */}
                  <div className="order-card__row-dish">
                    <span className="order-card__dish-title">
                      {card.primaryDishName} × {card.primaryQuantity}
                    </span>
                    <span className="order-card__dish-price">{card.totalText}</span>
                  </div>

                  {/* 第三行：就餐方式与时段 */}
                  <div className="order-card__row-meta">
                    {card.diningMode === 'TAKEAWAY' ? <ShoppingBagIcon /> : <ForkKnifeIcon />}
                    <span>{card.timeDiningText.split('·')[0]}·</span>
                    <span className="order-card__dining-mode">
                      {card.diningModeText}
                    </span>
                  </div>

                  {/* 第四行：操作按钮 */}
                  <div className="order-card__row-action">
                    <button
                      type="button"
                      className={card.actionType === 'primary' ? 'order-card__btn-primary' : 'order-card__btn-outline'}
                      onClick={() => onOpenOrder(card.id)}
                    >
                      {card.actionText}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </main>
      ) : null}

      {/* 底部 TabBar（全局导航条） */}
      <nav className="student-tabbar" aria-label="底部导航">
        <button
          type="button"
          className="student-tab-item"
          onClick={onGoToHome || onGoToShop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>首页</span>
        </button>

        <button
          type="button"
          className="student-tab-item"
          onClick={onGoToShop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          <span>点餐</span>
        </button>

        <button
          type="button"
          className="student-tab-item is-active"
          aria-current="page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>订单</span>
        </button>

        <button
          type="button"
          className="student-tab-item"
          onClick={onGoToProfile}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>我的</span>
        </button>
      </nav>
    </section>
  );
}
