import { useEffect, useState } from 'react';
import { runAfterBackPress } from '../../../shared/backPress';
import type { SourceError, StudentOrder, StudentSource } from '../types';
import { toSourceError } from '../types';
import { deriveOrderListView, toOrderListErrorView } from '../utils/orderListView';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import LoginGuide from '../components/LoginGuide';
import SampleBanner from '../components/SampleBanner';
import StudentTabBar from '../components/StudentTabBar';

import campusHero from '../assets/campus-hero.webp';
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

function OrderListHero() {
  return (
    <header className="order-list-hero" aria-labelledby="student-order-list-title">
      <svg className="order-list-hero__leaves" viewBox="0 0 150 76" fill="none" aria-hidden="true">
        <path d="M3 65C41 46 69 28 112 5" stroke="#537b32" strokeWidth="3" strokeLinecap="round" />
        <path d="M25 51C10 46 5 35 9 25c12 0 22 7 24 18M48 39C37 26 39 15 48 8c10 8 13 19 7 28M73 25C68 12 73 4 83 1c7 10 6 20-2 28M45 43c7-15 17-19 28-15-1 13-9 22-24 22M79 24c9-11 20-12 29-5-4 12-14 18-27 14" fill="#91ad57" stroke="#537b32" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="order-list-hero__heading">
        <p className="order-list-hero__eyebrow">食麦呼 · 校园取餐</p>
        <h1 id="student-order-list-title">我的订单<span aria-hidden="true">✳</span></h1>
        <span className="order-list-hero__underline" aria-hidden="true" />
      </div>
      <figure className="order-list-hero__campus">
        <img src={campusHero} alt="校园食堂与学生取餐场景" />
        <figcaption>今天的好味道，已经为你安排好</figcaption>
      </figure>
      <p className="order-list-hero__pickup">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        记得准时取餐
      </p>
      <p className="order-list-hero__note">每一餐，都安排好了</p>
    </header>
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
        <OrderListHero />
        <div style={{ padding: '1rem', position: 'relative', zIndex: 10 }}>
          <button type="button" className="student-secondary student-back" onClick={(event) => runAfterBackPress(event.currentTarget, onBack)}>
            {backLabel}
          </button>
          <LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} />
        </div>
        <StudentTabBar
          active="orders"
          onGoHome={onGoToHome || onGoToShop || onBack}
          onGoOrder={onGoToShop || onBack}
          onOpenOrders={() => undefined}
          onOpenProfile={onGoToProfile || onBack}
        />
      </section>
    );
  }

  return (
    <section className="student-order-list-page" aria-labelledby="student-order-list-title">
      {/* 顶部指示条 */}
      {source.mode === 'sample' ? <SampleBanner /> : null}

      <OrderListHero />

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
                  <button type="button" className="student-secondary student-back" onClick={(event) => runAfterBackPress(event.currentTarget, onBack)}>
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
      <StudentTabBar
        active="orders"
        onGoHome={onGoToHome || onGoToShop || onBack}
        onGoOrder={onGoToShop || onBack}
        onOpenOrders={() => undefined}
        onOpenProfile={onGoToProfile || onBack}
      />
    </section>
  );
}
