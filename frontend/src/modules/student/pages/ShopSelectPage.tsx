import { useEffect, useRef, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import type { DishDto, ShopSummary, SourceError, StudentSource } from '../types';
import { toSourceError } from '../types';
import { buildMenuDerivedShops } from '../utils/dishShopFilter';
import {
  deriveShopPickerState,
  resolveStallVisual,
  type ShopListSource,
} from '../utils/shopSelectView';
import { toSourceErrorView } from '../utils/sourceErrorView';
import {
  DERIVED_ENTRY_LABEL,
  DERIVED_ENTRY_NOTE,
  SHOP_LIST_LOADING,
  SHOP_LIST_UNAVAILABLE_HINT,
  SHOP_LIST_UNAVAILABLE_TEXT,
} from '../utils/shopTexts';
import { formatYuan } from '../utils/money';
import { todayAndTomorrow } from '../utils/dates';
import DemoModeNotice from '../components/DemoModeNotice';
import stallDazhong from '../assets/stall-dazhong.png';
import stallFengwei from '../assets/stall-fengwei.png';
import stallMianshi from '../assets/stall-mianshi.png';
import heroNoteBanner from '../assets/hero-note-banner.png';
import '../student-home.css';

export interface ShopSelectPageProps {
  source: StudentSource;
  draft: OrderDraft;
  currentShop: ShopSummary | null;
  notice: string;
  onEnterShop: (shop: ShopSummary) => void;
  onOpenOrders: () => void;
}

const STALL_PHOTOS = {
  dazhong: stallDazhong,
  fengwei: stallFengwei,
  mianshi: stallMianshi,
};

function Icon({ name }: { name: 'home' | 'bowl' | 'orders' | 'user' | 'arrow' | 'clock' }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10H3zM9 21v-7h6v7" />,
    bowl: (
      <>
        <path d="M3 12h18a9 9 0 0 1-18 0ZM5 21h14" />
        <path d="M9 8c0-2 2-2 2-4m4 5c0-2 2-2 2-4" />
      </>
    ),
    orders: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function pictureClass(name: string, index: number): string {
  if (/面|粉|汤/.test(name)) return 'noodles';
  if (/鸡|饭|肉/.test(name)) return 'rice';
  return index % 2 === 0 ? 'rice' : 'noodles';
}

export default function ShopSelectPage({
  source,
  draft,
  currentShop,
  notice,
  onEnterShop,
  onOpenOrders,
}: ShopSelectPageProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'order' | 'mine'>('order');
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SourceError | null>(null);
  const [listSource, setListSource] = useState<ShopListSource>('server');
  const [reloadToken, setReloadToken] = useState(0);
  const [derivedBusy, setDerivedBusy] = useState(false);
  const [derivedError, setDerivedError] = useState('');
  const [dishes, setDishes] = useState<DishDto[]>([]);
  const [menuError, setMenuError] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [showMoreShops, setShowMoreShops] = useState(false);
  const [activeSlide, setActiveSlide] = useState(1);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDerivedError('');
    setListSource('server');
    source.listShops().then(
      (data) => {
        if (cancelled) return;
        setShops(data);
        setListSource(source.mode === 'sample' ? 'demo' : 'server');
        setLoading(false);
      },
      (failure: unknown) => {
        if (cancelled) return;
        setShops([]);
        setError(toSourceError(failure));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    setMenuError(false);
    setMenuLoading(true);
    const recommendationDate =
      source.mode === 'real' ? todayAndTomorrow(new Date())[0] : draft.getState().date;
    source.getMenu(recommendationDate).then(
      (menu) => {
        if (!cancelled) {
          setDishes(menu.dishes.filter((dish) => dish.onSale && dish.availableQuantity > 0));
          setMenuLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setDishes([]);
          setMenuError(true);
          setMenuLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, draft, reloadToken]);

  async function loadDerivedShops(): Promise<void> {
    if (derivedBusy) return;
    setDerivedBusy(true);
    setDerivedError('');
    try {
      const menu = await source.getMenu(draft.getState().date);
      setShops(buildMenuDerivedShops(menu.dishes));
      setError(null);
      setListSource('menu-derived');
    } catch (failure) {
      setDerivedError(toSourceErrorView(failure));
    } finally {
      setDerivedBusy(false);
    }
  }

  const picker = deriveShopPickerState({
    shops,
    loading,
    error,
    mode: source.mode,
    currentShopId: currentShop?.merchantId ?? null,
    canSetShop: draft.canSetShop(),
    listSource,
  });

  const shopOf = (id: string) => shops.find((shop) => shop.merchantId === id) ?? null;
  const featuredDishes = dishes.filter((dish) => shopOf(dish.merchantId)).slice(0, 3);
  const carouselCards = Array.from({ length: 3 }, (_, index) => picker.cards[index] ?? null);

  useEffect(() => {
    if (
      activeTab !== 'home' ||
      picker.phase !== 'ready' ||
      carouselPaused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = window.setInterval(() => setActiveSlide((index) => (index + 1) % 3), 4000);
    return () => window.clearInterval(timer);
  }, [activeTab, picker.phase, carouselPaused, activeSlide]);

  function moveSlide(direction: -1 | 1): void {
    setActiveSlide((index) => (index + direction + 3) % 3);
  }

  return (
    <section className="student-order-view" aria-labelledby="student-order-title">
      <div className="student-home__scroll">
        {/* TAB 1: 点餐页面 (根据 photo/点餐页面.png 高保真制作) */}
        {activeTab === 'order' && (
          <>
            <header className="student-order-hero" aria-labelledby="student-order-title">
              <div className="student-order-hero__content">
                <div className="student-order-hero__title-wrap">
                  <h2 id="student-order-title" className="student-order-hero__title">
                    选择店铺
                    <svg className="student-order-hero__sunburst" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                      <path d="M4 22L1 25" stroke="#FFD525" strokeWidth="3.2" strokeLinecap="round" />
                      <path d="M14 14L23 8" stroke="#FFD525" strokeWidth="3.2" strokeLinecap="round" />
                      <path d="M16 22L26 21" stroke="#FFD525" strokeWidth="3.2" strokeLinecap="round" />
                    </svg>
                  </h2>
                  <svg className="student-order-hero__underline" viewBox="0 0 170 16" fill="none" aria-hidden="true">
                    <path d="M4 11C55 2 115 3 166 12" stroke="#FFD525" strokeWidth="4.2" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="student-order-hero__banner-wrap">
                  <img
                    src={heroNoteBanner}
                    alt="今天，去哪家吃？"
                    className="student-order-hero__banner-img"
                  />
                </div>
              </div>
            </header>

            <div className="student-order-body">
              <div className="student-order-mode-wrap">
                <div className="student-home__mode" role="note">
                  {source.mode === 'sample'
                    ? '样例数据 · 不代表真实供应与现场人数'
                    : '真实接口 · 菜单和店铺来自公共服务'}
                </div>
              </div>

              {notice ? <p className="student-notice" role="status">{notice}</p> : null}

              {picker.phase === 'loading' ? (
                <p className="student-loading">{SHOP_LIST_LOADING}</p>
              ) : null}

              {picker.phase === 'error' && error ? (
                <div className="student-error" role="alert">
                  <p>{toSourceErrorView(error)}</p>
                  <button
                    type="button"
                    className="student-secondary"
                    onClick={() => setReloadToken((value) => value + 1)}
                  >
                    重新读取
                  </button>
                </div>
              ) : null}

              {picker.phase === 'unavailable' ? (
                <div className="student-error student-shop-derived" role="alert">
                  <p>{SHOP_LIST_UNAVAILABLE_TEXT}</p>
                  <p className="student-order-note">{SHOP_LIST_UNAVAILABLE_HINT}</p>
                  <button
                    type="button"
                    className="student-secondary"
                    onClick={() => setReloadToken((value) => value + 1)}
                  >
                    重新读取
                  </button>
                  {picker.showDerivedEntry ? (
                    <>
                      <button
                        type="button"
                        className="student-secondary student-shop-derived__entry"
                        disabled={derivedBusy}
                        onClick={loadDerivedShops}
                      >
                        {DERIVED_ENTRY_LABEL}
                      </button>
                      <p className="student-order-note">{DERIVED_ENTRY_NOTE}</p>
                    </>
                  ) : null}
                  {derivedError ? <p className="student-error__inline">{derivedError}</p> : null}
                </div>
              ) : null}

              {picker.phase === 'empty' ? (
                <div className="student-empty" role="status">
                  <p>{picker.emptyText}</p>
                  <button
                    type="button"
                    className="student-secondary"
                    onClick={() => setReloadToken((value) => value + 1)}
                  >
                    重新读取
                  </button>
                </div>
              ) : null}

              {picker.phase === 'ready' ? (
                <>
                  <div className="student-order-cards" role="list" aria-label="档口列表">
                    {picker.cards.slice(0, 3).map((card, index) => {
                      const shop = shopOf(card.merchantId);
                      const visual = resolveStallVisual(card, index);
                      const photoSrc = STALL_PHOTOS[visual.photoKey];

                      return (
                        <article
                          key={card.merchantId}
                          className={`student-order-card${card.isCurrent ? ' is-current' : ''}`}
                          role="listitem"
                          data-merchant-id={card.merchantId}
                          onClick={() => {
                            if (card.enterable && shop) onEnterShop(shop);
                          }}
                        >
                          <div className="student-order-card__photo-box">
                            <img
                              src={photoSrc}
                              alt={visual.photoAlt}
                              className="student-order-card__photo"
                              loading="lazy"
                            />
                          </div>

                          <div className="student-order-card__info">
                            <h3 className="student-order-card__title">{visual.title}</h3>
                            <span className="student-order-card__badge">{visual.tag}</span>

                            <button
                              type="button"
                              className="student-order-card__action"
                              disabled={!card.enterable || shop === null}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (card.enterable && shop) onEnterShop(shop);
                              }}
                              aria-label={`进入${visual.title}看看`}
                            >
                              <div className="student-order-card__action-row">
                                <span className="student-order-card__action-text">进店看看</span>
                                <span className="student-order-card__action-arrow" aria-hidden="true">→</span>
                              </div>
                              <svg
                                className="student-order-card__action-underline"
                                viewBox="0 0 76 10"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M2 5.5C20 9 52 2.5 74 6.5"
                                  stroke="#FFD525"
                                  strokeWidth="3.4"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>

                            {card.disabledReason ? (
                              <p className="student-order-card__disabled">{card.disabledReason}</p>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {picker.cards.length > 3 ? (
                    <div className="student-home__more-shops">
                      <button
                        type="button"
                        className="student-home__more-toggle"
                        aria-expanded={showMoreShops}
                        onClick={() => setShowMoreShops((value) => !value)}
                      >
                        {showMoreShops
                          ? '收起其余店铺'
                          : `查看其余 ${picker.cards.length - 3} 家店铺`}
                        <Icon name="arrow" />
                      </button>
                      {showMoreShops ? (
                        <ul aria-label="其余店铺">
                          {picker.cards.slice(3).map((card) => {
                            const shop = shopOf(card.merchantId);
                            return (
                              <li key={card.merchantId} data-merchant-id={card.merchantId}>
                                <span>
                                  <strong>{card.title}</strong>
                                  <small>{card.orderableText}</small>
                                </span>
                                <button
                                  type="button"
                                  disabled={!card.enterable || shop === null}
                                  onClick={() => {
                                    if (shop) onEnterShop(shop);
                                  }}
                                >
                                  进店点餐
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  {source.mode === 'sample' ? <DemoModeNotice /> : null}
                </>
              ) : null}
            </div>
          </>
        )}

        {/* TAB 2: 首页视图 (轮播与推荐) */}
        {activeTab === 'home' && (
          <div className="student-home">
            <header className="student-home__hero">
              <div className="student-home__hero-content">
                <p className="student-home__brand">校园食堂 <span aria-hidden="true">✳</span></p>
                <div className="student-home__hero-note">
                  <h2>今天想吃什么？</h2>
                  <p>好好吃饭，从这里开始</p>
                </div>
              </div>
            </header>

            <div className="student-home__paper">
              <div className="student-home__mode" role="note">
                {source.mode === 'sample' ? '样例数据 · 不代表真实供应与现场人数' : '真实接口 · 菜单和店铺来自公共服务'}
              </div>
              {notice ? <p className="student-notice" role="status">{notice}</p> : null}

              <section id="student-home-shops" className="student-home__section" aria-labelledby="student-home-shops-title">
                <div className="student-home__heading">
                  <h3 id="student-home-shops-title" className="student-home__section-title">选择店铺<span className="student-home__spark" aria-hidden="true">✳</span></h3>
                  <span className="student-home__section-aside">选一家喜欢的，开始点餐</span>
                </div>
                {picker.phase === 'loading' ? <p className="student-loading">{SHOP_LIST_LOADING}</p> : null}
                {picker.phase === 'ready' ? (
                  <>
                    <div
                      className="student-home__carousel"
                      role="region"
                      aria-label="店铺图片轮播"
                      onMouseEnter={() => setCarouselPaused(true)}
                      onMouseLeave={() => setCarouselPaused(false)}
                      onFocusCapture={() => setCarouselPaused(true)}
                      onBlurCapture={() => setCarouselPaused(false)}
                      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
                      onTouchEnd={(event) => {
                        if (touchStartX.current === null) return;
                        const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
                        if (Math.abs(distance) > 40) moveSlide(distance > 0 ? -1 : 1);
                        touchStartX.current = null;
                      }}
                    >
                      <ul className="student-home__shop-list" aria-label="店铺列表">
                        {carouselCards.map((card, index) => {
                          const position = index === activeSlide ? 'center' : (index - activeSlide + 3) % 3 === 1 ? 'right' : 'left';
                          if (card === null) {
                            return (
                              <li key={`photo-${index}`} className={`student-home__shop-slide is-${position}`} aria-hidden={position !== 'center'}>
                                <div className="student-home__shop-card student-home__shop-card--showcase">
                                  <div className="student-home__shop-photo student-home__shop-photo--noodles" aria-hidden="true" />
                                  <div className="student-home__shop-body">
                                    <p className="student-shop-card__name">更多档口</p>
                                    <p className="student-home__shop-meta">图片展示 · 可下单店铺以列表为准</p>
                                    <button type="button" className="student-home__shop-enter" disabled={position !== 'center'} onClick={() => setActiveSlide(0)}>查看可点餐店铺 <Icon name="arrow" /></button>
                                  </div>
                                </div>
                              </li>
                            );
                          }
                          const shop = shopOf(card.merchantId);
                          return (
                            <li key={card.merchantId} className={`student-home__shop-slide is-${position}`} aria-hidden={position !== 'center'}>
                              <div className={`student-shop-card student-home__shop-card${card.isCurrent ? ' is-current' : ''}`} data-demo={card.demo ? 'true' : 'false'} data-shop-source={picker.listSource} data-merchant-id={card.merchantId}>
                                <div className={`student-home__shop-photo student-home__shop-photo--${['counter', 'wok', 'noodles'][index % 3]}`} aria-hidden="true" />
                                <div className="student-home__shop-body">
                                  <div className="student-shop-card__head">
                                    <p className="student-shop-card__name">{card.title}</p>
                                    {card.demoLabel ? <span className="student-shop-card__demo">{card.demoLabel}</span> : null}
                                    {card.isCurrent ? <span className="student-shop-card__current">当前店铺</span> : null}
                                  </div>
                                  <p className="student-home__shop-meta">{card.orderableText}{card.nameNote ? ` · ${card.nameNote}` : ''}</p>
                                  <button type="button" className="student-primary student-shop-card__enter student-home__shop-enter" disabled={!card.enterable || shop === null || position !== 'center'} onClick={() => { if (shop) onEnterShop(shop); }} aria-label={`进入${card.title}点餐`}><span>{card.isCurrent ? '继续点餐' : '进店点餐'}</span><Icon name="arrow" /></button>
                                  {card.disabledReason ? <p className="student-shop-card__disabled">{card.disabledReason}</p> : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="student-home__carousel-controls">
                        <button type="button" className="student-home__carousel-arrow" aria-label="上一张店铺图片" onClick={() => moveSlide(-1)}>‹</button>
                        <div className="student-home__carousel-dots" aria-label="选择店铺图片">
                          {carouselCards.map((_, index) => <button key={index} type="button" className={index === activeSlide ? 'is-active' : ''} aria-label={`第 ${index + 1} 张`} aria-pressed={index === activeSlide} onClick={() => setActiveSlide(index)} />)}
                        </div>
                        <button type="button" className="student-home__carousel-arrow" aria-label="下一张店铺图片" onClick={() => moveSlide(1)}>›</button>
                      </div>
                      <p className="student-home__swipe-hint">左右滑动，发现更多档口</p>
                    </div>
                  </>
                ) : null}
              </section>

              <section className="student-home__section student-home__recommend" aria-labelledby="student-home-recommend-title">
                <div className="student-home__heading"><h3 id="student-home-recommend-title" className="student-home__section-title">{source.mode === 'sample' ? '样例推荐' : '今日推荐'}<span className="student-home__spark" aria-hidden="true">✳</span></h3><span className="student-home__section-aside">图片仅供参考</span></div>
                {menuLoading ? <p className="student-home__empty">正在读取今日菜单…</p> : menuError ? <p className="student-home__empty">菜单暂时无法读取，请稍后再试。</p> : featuredDishes.length === 0 ? <p className="student-home__empty">暂无可推荐的菜品，选择店铺看看菜单吧。</p> : (
                  <div className="student-home__dishes">
                    {featuredDishes.map((dish, index) => {
                      const shop = shopOf(dish.merchantId);
                      return (
                        <button key={dish.dishId} type="button" className={`student-home__dish ${index === 0 ? 'student-home__dish--featured' : ''}`} onClick={() => { if (shop) onEnterShop(shop); }}>
                          <span className={`student-home__dish-photo student-home__dish-photo--${pictureClass(dish.name, index)}`} aria-hidden="true" />
                          <span className="student-home__dish-info"><strong>{dish.name}</strong><small>{shop?.name ?? '进入店铺查看'}</small><span className="student-home__dish-price">{formatYuan(dish.unitPriceFen)}</span></span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="student-home__meal-time"><Icon name="clock" /><span>午餐时段请在店内选择</span></div>
              </section>
              {source.mode === 'sample' ? <DemoModeNotice /> : null}
            </div>
          </div>
        )}

        {/* TAB 3: 我的视图 */}
        {activeTab === 'mine' && (
          <div className="student-home">
            <header className="student-home__hero">
              <div className="student-home__hero-content">
                <p className="student-home__brand">校园食堂 <span aria-hidden="true">✳</span></p>
                <div className="student-home__hero-note">
                  <h2>个人中心</h2>
                  <p>账号与订单管理</p>
                </div>
              </div>
            </header>
            <div className="student-home__paper">
              <section className="student-home__mine" aria-label="我的">
                <h3 className="student-home__section-title">我的信息</h3>
                <p>查看账号状态和我的订单。</p>
                <button type="button" className="student-home__mine-row" onClick={onOpenOrders}>
                  我的订单 <Icon name="arrow" />
                </button>
                <button type="button" className="student-home__mine-row" onClick={() => { window.location.hash = '/system-check'; }}>
                  账号与登录 <Icon name="arrow" />
                </button>
                <p className="student-home__fineprint">
                  {source.mode === 'sample' ? '当前是样例模式' : '订单与金额以服务端结果为准'}
                </p>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* 底部导航栏：对齐参考图样式，点餐 Tab 具备专属高亮黄色椭圆块 */}
      <nav className="student-home__nav" aria-label="学生端导航">
        <button
          type="button"
          className={activeTab === 'home' ? 'is-active-tab' : ''}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          onClick={() => {
            setActiveTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Icon name="home" />
          <span>首页</span>
          {activeTab === 'home' ? <span className="nav-pill-blob" aria-hidden="true" /> : null}
        </button>

        <button
          type="button"
          className={activeTab === 'order' ? 'is-active-tab' : ''}
          aria-current={activeTab === 'order' ? 'page' : undefined}
          onClick={() => {
            setActiveTab('order');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Icon name="bowl" />
          <span>点餐</span>
          {activeTab === 'order' ? <span className="nav-pill-blob" aria-hidden="true" /> : null}
        </button>

        <button type="button" onClick={onOpenOrders}>
          <Icon name="orders" />
          <span>订单</span>
        </button>

        <button
          type="button"
          className={activeTab === 'mine' ? 'is-active-tab' : ''}
          aria-current={activeTab === 'mine' ? 'page' : undefined}
          onClick={() => {
            setActiveTab('mine');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Icon name="user" />
          <span>我的</span>
          {activeTab === 'mine' ? <span className="nav-pill-blob" aria-hidden="true" /> : null}
        </button>
      </nav>
    </section>
  );
}
