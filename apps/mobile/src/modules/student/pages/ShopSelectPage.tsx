import { useEffect, useRef, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import type { DishDto, ShopSummary, SourceError, StudentSource } from '../types';
import { toSourceError } from '../types';
import { buildMenuDerivedShops, filterDishesByShop } from '../utils/dishShopFilter';
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
import {
  STALL_PHOTOS,
  matchesOrderCategory,
  pickPreviewDishes,
  resolveDishPhoto,
  type OrderCategoryId,
} from '../utils/orderVisuals';
import DemoModeNotice from '../components/DemoModeNotice';
import HomeFeed from '../components/HomeFeed';
import OrderCategoryGrid from '../components/OrderCategoryGrid';
import '../student-home.css';

export interface ShopSelectPageProps {
  source: StudentSource;
  draft: OrderDraft;
  currentShop: ShopSummary | null;
  notice: string;
  activeTab?: 'home' | 'order';
  onTabChange?: (tab: 'home' | 'order') => void;
  onEnterShop: (shop: ShopSummary) => void;
  onOpenOrders: () => void;
  onOpenProfile?: () => void;
}

type OrderFilterId = 'all' | 'canteen-1' | 'canteen-2' | 'open' | 'reservable';

function Icon({
  name,
}: {
  name:
    | 'home'
    | 'bowl'
    | 'orders'
    | 'user'
    | 'arrow'
    | 'clock'
    | 'search'
    | 'pin'
    | 'utensils'
    | 'flame'
    | 'canteen1'
    | 'canteen2'
    | 'calendar'
    | 'close';
}) {
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
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.8-3.8" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s6-5.4 6-10.2A6 6 0 1 0 6 10.8C6 15.6 12 21 12 21Z" />
        <circle cx="12" cy="10.5" r="2" />
      </>
    ),
    utensils: (
      <>
        <path d="M5 3v7a2.5 2.5 0 0 0 5 0V3M7.5 3v18M16 3c0 4 3 5 3 8v10M16 11h3" />
      </>
    ),
    flame: (
      <path d="M12 3c1.5 3 4.5 4.6 4.5 8.2a4.5 4.5 0 1 1-9 0c0-1.6.7-3.2 1.8-4.4.2 1.4 1.1 2.2 2 2.2.7 0 1.2-.5 1.2-1.4C12.5 6.1 12 4.5 12 3Z" />
    ),
    canteen1: (
      <>
        <path d="M4 10 12 4l8 6v10H4V10Z" />
        <path d="M9 20v-5h6v5M9 11h6" />
      </>
    ),
    canteen2: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="1.5" />
        <path d="M8 9h2M14 9h2M8 13h2M14 13h2M10 20v-3h4v3" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16m-6.5 4.5 1.8 1.8 3.2-3.3" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function formatShortYuan(fen: number): string {
  return fen % 100 === 0 ? `¥${fen / 100}` : formatYuan(fen);
}

export default function ShopSelectPage({
  source,
  draft,
  currentShop,
  notice,
  activeTab: controlledTab,
  onTabChange,
  onEnterShop,
  onOpenOrders,
  onOpenProfile,
}: ShopSelectPageProps) {
  const [internalTab, setInternalTab] = useState<'home' | 'order' | 'mine'>('home');
  const activeTab = controlledTab ?? internalTab;
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SourceError | null>(null);
  const [listSource, setListSource] = useState<ShopListSource>('server');
  const [reloadToken, setReloadToken] = useState(0);
  const [shopReloadToken, setShopReloadToken] = useState(0);
  const [derivedBusy, setDerivedBusy] = useState(false);
  const [derivedError, setDerivedError] = useState('');
  const [dishes, setDishes] = useState<DishDto[]>([]);
  const [menuError, setMenuError] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<OrderCategoryId>('all');
  const [activeFilter, setActiveFilter] = useState<OrderFilterId>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [signNudged, setSignNudged] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);

  function selectTab(next: 'home' | 'order' | 'mine'): void {
    if (next === 'order') {
      resetOrderFilters();
      setShopReloadToken((value) => value + 1);
    }
    setInternalTab(next);
    if (next !== 'mine') {
      onTabChange?.(next);
    }
  }

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
  }, [source, reloadToken, shopReloadToken]);

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

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    return () => {
      if (nudgeTimerRef.current !== null) {
        window.clearTimeout(nudgeTimerRef.current);
      }
    };
  }, []);

  function triggerSignNudge(): void {
    if (nudgeTimerRef.current !== null) {
      window.clearTimeout(nudgeTimerRef.current);
    }
    setSignNudged(false);
    window.requestAnimationFrame(() => {
      setSignNudged(true);
      nudgeTimerRef.current = window.setTimeout(() => {
        setSignNudged(false);
        nudgeTimerRef.current = null;
      }, 1200);
    });
  }

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

  function resetOrderFilters(): void {
    setSelectedCategory('all');
    setActiveFilter('all');
    setSearchQuery('');
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const decoratedCards = picker.cards.map((card, index) => {
    const shopDishes = filterDishesByShop(dishes, card.merchantId);
    const dishNames = shopDishes.map((dish) => dish.name);
    const visual = resolveStallVisual(card, index, dishNames);
    const previewDishes = pickPreviewDishes(shopDishes);
    return {
      card,
      shop: shopOf(card.merchantId),
      visual,
      previewDishes,
      dishNames,
    };
  });

  const visibleCards = decoratedCards.filter(({ card, visual, dishNames }) => {
    if (activeFilter === 'canteen-1' && visual.canteenGroup !== '一食堂') return false;
    if (activeFilter === 'canteen-2' && visual.canteenGroup !== '二食堂') return false;
    if (activeFilter === 'open' && !visual.isOpen) return false;
    if (activeFilter === 'reservable' && !card.enterable) return false;
    if (!matchesOrderCategory(selectedCategory, visual.title, dishNames)) return false;
    if (trimmedQuery !== '') {
      const hay = `${visual.title} ${visual.specialties} ${visual.location} ${dishNames.join(' ')}`.toLowerCase();
      if (!hay.includes(trimmedQuery)) return false;
    }
    return true;
  });

  const hasActiveFilters =
    activeFilter !== 'all' || selectedCategory !== 'all' || trimmedQuery !== '';

  return (
    <section
      className="student-order-view"
      aria-labelledby={activeTab === 'home' ? 'student-home-title' : 'student-order-title'}
    >
      <div className="student-home__scroll">
        {/* TAB 1: 点餐页面 */}
        {activeTab === 'order' && (
          <div className="order-feed">
            <header className="order-topbar">
              <div className="order-topbar__brand">
                <div className="order-topbar__title-row">
                  <h1 id="student-order-title" className="order-topbar__logo">
                    食麦呼
                  </h1>
                  <span className="order-topbar__spark" aria-hidden="true">
                    ✳
                  </span>
                </div>
                <p className="order-topbar__subtitle">西安邮电大学 · 校园美食平台</p>
              </div>

              <button
                type="button"
                className={`order-hanging-note${signNudged ? ' is-nudged' : ''}`}
                aria-label="今天去哪家吃？点击轻晃木牌"
                onClick={triggerSignNudge}
              >
                <span className="order-hanging-note__ropes" aria-hidden="true">
                  <span className="order-hanging-note__rope order-hanging-note__rope--left" />
                  <span className="order-hanging-note__rope order-hanging-note__rope--right" />
                </span>
                <span className="order-hanging-note__board">
                  <span className="order-hanging-note__pin order-hanging-note__pin--left" aria-hidden="true" />
                  <span className="order-hanging-note__pin order-hanging-note__pin--right" aria-hidden="true" />
                  <span className="order-hanging-note__text">今天去哪家吃？</span>
                  <svg
                    className="order-hanging-note__sparkles"
                    viewBox="0 0 22 22"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 13L11 5" stroke="#F5C400" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M9 15L18 11" stroke="#F5C400" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M11 19L19 18" stroke="#F5C400" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </span>
              </button>

              <button
                type="button"
                className={`order-topbar__search${searchOpen ? ' is-active' : ''}`}
                aria-label={searchOpen ? '收起搜索' : '搜索档口或菜品'}
                aria-expanded={searchOpen}
                onClick={() => {
                  if (searchOpen) {
                    setSearchQuery('');
                    setSearchOpen(false);
                  } else {
                    setSearchOpen(true);
                  }
                }}
              >
                <Icon name={searchOpen ? 'close' : 'search'} />
              </button>
            </header>

            {searchOpen ? (
              <div className="order-search-panel">
                <div className="order-search-box">
                  <Icon name="search" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索档口名称或想吃的菜品…"
                    aria-label="搜索档口或菜品"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="order-search-box__clear"
                      aria-label="清空搜索词"
                      onClick={() => setSearchQuery('')}
                    >
                      清空
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* 想吃点什么？ */}
            <section className="order-section" aria-labelledby="order-cat-heading">
              <div className="order-section__head">
                <h2 id="order-cat-heading" className="order-section__bar-title">
                  <span className="order-section__bar" aria-hidden="true" />
                  想吃点什么？
                </h2>
                <button
                  type="button"
                  className="order-section__more"
                  onClick={resetOrderFilters}
                >
                  全部分类 <Icon name="arrow" />
                </button>
              </div>

              <OrderCategoryGrid
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </section>

            {/* 为你推荐 */}
            <section className="order-section" aria-labelledby="order-rec-heading">
              <div className="order-section__head order-section__head--rec">
                <div className="order-rec-title-wrap">
                  <h2 id="order-rec-heading" className="order-rec-title">
                    为你推荐
                  </h2>
                  <svg
                    className="order-rec-title__stroke"
                    viewBox="0 0 116 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8.5C32 4.5 76 3.5 113 7.5"
                      stroke="#FFD525"
                      strokeWidth="4.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <button
                  type="button"
                  className="order-section__more"
                  onClick={() => {
                    resetOrderFilters();
                    setShopReloadToken((value) => value + 1);
                  }}
                >
                  刷新全部店铺 <Icon name="arrow" />
                </button>
              </div>

              <div className="order-filter-row" role="tablist" aria-label="档口筛选条件">
                {(
                  [
                    { id: 'all', label: '全部', icon: null },
                    { id: 'canteen-1', label: '一食堂', icon: 'canteen1' },
                    { id: 'canteen-2', label: '二食堂', icon: 'canteen2' },
                    { id: 'open', label: '营业中', icon: 'flame' },
                    { id: 'reservable', label: '可预约', icon: 'calendar' },
                  ] as const
                ).map((pill) => {
                  const isActive = activeFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`order-filter-pill${isActive ? ' is-active' : ''}`}
                      onClick={() => setActiveFilter(pill.id)}
                    >
                      {pill.icon ? (
                        <span className={`order-filter-pill__icon is-${pill.id}`}>
                          <Icon name={pill.icon} />
                        </span>
                      ) : null}
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>

              {notice ? (
                <p className="student-notice" role="status">
                  {notice}
                </p>
              ) : null}

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
                  {visibleCards.length === 0 ? (
                    <div className="order-filter-empty" role="status">
                      <p>当前筛选下暂无匹配的档口</p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          className="order-filter-empty__btn"
                          onClick={resetOrderFilters}
                        >
                          查看全部档口
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="order-stall-list" role="list" aria-label="推荐档口列表">
                      {visibleCards.map(({ card, shop, visual, previewDishes }) => (
                        <article
                          key={card.merchantId}
                          role="listitem"
                          data-merchant-id={card.merchantId}
                          className={`order-stall-card${card.isCurrent ? ' is-current' : ''}${!card.enterable ? ' is-disabled' : ''}`}
                          onClick={() => {
                            if (card.enterable && shop) onEnterShop(shop);
                          }}
                        >
                          <div className="order-stall-card__head">
                            <div className="order-stall-card__cover">
                              <img
                                src={STALL_PHOTOS[visual.photoKey]}
                                alt={visual.photoAlt}
                                loading="lazy"
                              />
                            </div>

                            <div className="order-stall-card__info">
                              <h3 className="order-stall-card__title">{visual.title}</h3>
                              <p className="order-stall-card__meta">
                                <Icon name="pin" />
                                <span>{visual.location}</span>
                              </p>
                              <p className="order-stall-card__meta">
                                <Icon name="utensils" />
                                <span>{visual.specialties}</span>
                              </p>
                              <div className="order-stall-card__badges">
                                <span
                                  className={`order-stall-badge${visual.isOpen ? ' is-open' : ' is-closed'}`}
                                >
                                  {visual.statusLabel}
                                </span>
                                <span
                                  className={`order-stall-badge ${visual.featureKind === 'popular' ? 'is-popular' : 'is-reservable'}`}
                                >
                                  <Icon
                                    name={visual.featureKind === 'popular' ? 'flame' : 'clock'}
                                  />
                                  {visual.featureLabel}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="order-stall-card__go"
                              disabled={!card.enterable || shop === null}
                              aria-label={`进入${visual.title}点餐`}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (card.enterable && shop) onEnterShop(shop);
                              }}
                            >
                              <Icon name="arrow" />
                            </button>
                          </div>

                          {previewDishes.length > 0 ? (
                            <div
                              className="order-stall-card__dishes"
                              aria-label={`${visual.title}推荐菜品`}
                            >
                              {previewDishes.map((dish, dishIndex) => (
                                <button
                                  key={dish.dishId}
                                  type="button"
                                  className="order-dish-thumb"
                                  disabled={!card.enterable || shop === null}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (card.enterable && shop) onEnterShop(shop);
                                  }}
                                >
                                  <img
                                    src={resolveDishPhoto(dish.name, dishIndex)}
                                    alt={dish.name}
                                    loading="lazy"
                                  />
                                  <span className="order-dish-thumb__scrim" aria-hidden="true" />
                                  <span className="order-dish-thumb__caption">
                                    <span className="order-dish-thumb__name">{dish.name}</span>
                                    <strong className="order-dish-thumb__price">
                                      {formatShortYuan(dish.unitPriceFen)}
                                    </strong>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {card.disabledReason ? (
                            <p className="order-stall-card__disabled">{card.disabledReason}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}

                  {source.mode === 'sample' ? (
                    <div className="order-mode-footer">
                      <DemoModeNotice />
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        )}

        {/* TAB 2: 首页视图 (轮播与推荐) */}
        {activeTab === 'home' && (
          <HomeFeed
            mode={source.mode}
            picker={picker}
            shops={shops}
            dishes={dishes}
            error={error}
            menuLoading={menuLoading}
            menuError={menuError}
            notice={notice}
            derivedBusy={derivedBusy}
            derivedError={derivedError}
            onEnterShop={onEnterShop}
            onGoToOrderTab={() => {
              selectTab('order');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onRetry={() => setReloadToken((value) => value + 1)}
            onLoadDerivedShops={loadDerivedShops}
          />
        )}

        {/* TAB 3: 我的视图 (当未传 onOpenProfile 时的兜底) */}
        {activeTab === 'mine' && (
          <div className="student-home">
            <header className="student-home__hero">
              <div className="student-home__hero-content">
                <p className="student-home__brand">
                  校园食堂 <span aria-hidden="true">✳</span>
                </p>
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
                <button
                  type="button"
                  className="student-home__mine-row"
                  onClick={() => {
                    window.location.hash = '/system-check';
                  }}
                >
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

      {/* 底部导航栏 */}
      <nav className="student-home__nav" aria-label="学生端导航">
        <button
          type="button"
          className={activeTab === 'home' ? 'is-active-tab' : ''}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          onClick={() => {
            selectTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="nav-tab-pill">
            <Icon name="home" />
            <span>首页</span>
          </span>
        </button>

        <button
          type="button"
          className={activeTab === 'order' ? 'is-active-tab' : ''}
          aria-current={activeTab === 'order' ? 'page' : undefined}
          onClick={() => {
            selectTab('order');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="nav-tab-pill">
            <Icon name="bowl" />
            <span>点餐</span>
          </span>
        </button>

        <button type="button" onClick={onOpenOrders}>
          <span className="nav-tab-pill">
            <Icon name="orders" />
            <span>订单</span>
          </span>
        </button>

        <button
          type="button"
          className={activeTab === 'mine' ? 'is-active-tab' : ''}
          aria-current={activeTab === 'mine' ? 'page' : undefined}
          onClick={() => {
            if (onOpenProfile) {
              onOpenProfile();
            } else {
              selectTab('mine');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <span className="nav-tab-pill">
            <Icon name="user" />
            <span>我的</span>
          </span>
        </button>
      </nav>
    </section>
  );
}
