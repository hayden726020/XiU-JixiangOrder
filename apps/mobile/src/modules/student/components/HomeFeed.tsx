import { useEffect, useRef, useState } from 'react';
import type { DishDto, ShopSummary, SourceError, StudentMode } from '../types';
import type { ShopCardView, ShopPickerState } from '../utils/shopSelectView';
import { toSourceErrorView } from '../utils/sourceErrorView';
import {
  DERIVED_ENTRY_LABEL,
  DERIVED_ENTRY_NOTE,
  SHOP_LIST_LOADING,
  SHOP_LIST_UNAVAILABLE_HINT,
  SHOP_LIST_UNAVAILABLE_TEXT,
} from '../utils/shopTexts';
import { formatYuan } from '../utils/money';
import { resolveDishPhoto } from '../utils/orderVisuals';
import DemoModeNotice from './DemoModeNotice';
import './home-feed.css';
import noodleCounterPhoto from '../assets/noodle-counter.png';
import stallCounterJiachang from '../assets/stall-counter-jiachang.png';
import stallCounterXiaochao from '../assets/stall-counter-xiaochao.png';
import dishChickenLeg from '../assets/dish-chicken-leg.png';
import warmNoodleBanner from '../assets/warm-noodle-banner.jpg';

export interface HomeFeedProps {
  mode: StudentMode;
  picker: ShopPickerState;
  shops: ShopSummary[];
  dishes: DishDto[];
  error: SourceError | null;
  menuLoading: boolean;
  menuError: boolean;
  notice: string;
  derivedBusy: boolean;
  derivedError: string;
  onEnterShop: (shop: ShopSummary) => void;
  onGoToOrderTab: () => void;
  onRetry: () => void;
  onLoadDerivedShops: () => void;
}

interface PolaroidSlide {
  key: string;
  label: string;
  photo: string;
  photoAlt: string;
  kind: 'shop' | 'all-stalls';
  shop: ShopSummary | null;
  enterable: boolean;
  disabledReason: string;
}

function BrushUnderline({ className = 'home-brush-underline' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 132 14" fill="none" aria-hidden="true">
      <path
        d="M4 10.2C36 4.2 88 2.8 128 7.6"
        stroke="#F6CA26"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkRays({ className = 'home-spark-rays' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 22" fill="none" aria-hidden="true">
      <path d="M4 12L10 4" stroke="#F6CA26" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 15L18 10" stroke="#F6CA26" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9 19L20 18" stroke="#F6CA26" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg className="home-crown-icon" viewBox="0 0 20 16" fill="currentColor" aria-hidden="true">
      <path d="M2 13L1 5l4.8 3.5L10 2l4.2 6.5L19 5l-1 8H2Zm0 1.5h16v1.5H2v-1.5Z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
    </svg>
  );
}

function WheatSprig() {
  return (
    <svg className="home-featured__wheat" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <path d="M12 64C24 48 38 30 58 10" stroke="#D9C79E" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="30" cy="40" rx="5.5" ry="2.6" transform="rotate(-48 30 40)" fill="#E3D4B1" />
      <ellipse cx="40" cy="44" rx="5.5" ry="2.6" transform="rotate(-12 40 44)" fill="#E3D4B1" />
      <ellipse cx="38" cy="30" rx="5.5" ry="2.6" transform="rotate(-52 38 30)" fill="#E3D4B1" />
      <ellipse cx="48" cy="34" rx="5.5" ry="2.6" transform="rotate(-12 48 34)" fill="#E3D4B1" />
      <ellipse cx="47" cy="21" rx="5.2" ry="2.4" transform="rotate(-54 47 21)" fill="#E3D4B1" />
      <ellipse cx="56" cy="24" rx="5.2" ry="2.4" transform="rotate(-12 56 24)" fill="#E3D4B1" />
    </svg>
  );
}

function SteamLines() {
  return (
    <svg className="home-promo__steam" viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <path d="M5 20C3 15 8 11 6 5" stroke="#F6CA26" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 19C11 14 16 10 14 4" stroke="#F6CA26" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M21 20C19 15 24 11 22 5" stroke="#F6CA26" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function formatPriceParts(fen: number): { symbol: string; numberText: string } {
  const text = fen % 100 === 0 ? String(fen / 100) : formatYuan(fen).replace(/^¥/, '');
  return { symbol: '¥', numberText: text };
}

function resolveHomeDishPhoto(name: string, index: number): string {
  if (/鸡肉饭|鸡腿|烤鸡/.test(name)) return dishChickenLeg;
  return resolveDishPhoto(name, index);
}

function shortenPolaroidLabel(title: string, fallback: string): string {
  const cleaned = title.replace(/^.*?·\s*/, '').trim();
  if (cleaned === '家常菜档') return '家常档';
  if (cleaned.length > 0 && cleaned.length <= 6) return cleaned;
  return title || fallback;
}

function buildPolaroidSlides(
  cards: ShopCardView[],
  shopOf: (merchantId: string) => ShopSummary | null,
): PolaroidSlide[] {
  const wokCard =
    cards.find((card) => /小炒|风味/.test(card.title)) ??
    cards[2] ??
    cards[0] ??
    null;
  const homeCard =
    cards.find((card) => /家常|大众/.test(card.title) && card.merchantId !== wokCard?.merchantId) ??
    cards.find((card) => card.merchantId !== wokCard?.merchantId) ??
    cards[0] ??
    null;

  const leftShop = wokCard ? shopOf(wokCard.merchantId) : null;
  const rightShop = homeCard ? shopOf(homeCard.merchantId) : null;

  return [
    {
      key: wokCard ? `slide-${wokCard.merchantId}` : 'slide-left',
      label: wokCard ? (/一食堂/.test(wokCard.title) ? '一食堂' : shortenPolaroidLabel(wokCard.title, '一食堂')) : '一食堂',
      photo: stallCounterXiaochao,
      photoAlt: wokCard?.title ?? '一食堂炒菜档口',
      kind: wokCard ? 'shop' : 'all-stalls',
      shop: leftShop,
      enterable: wokCard ? wokCard.enterable && leftShop !== null : true,
      disabledReason: wokCard?.disabledReason ?? '',
    },
    {
      key: 'slide-all-stalls',
      label: '更多档口',
      photo: noodleCounterPhoto,
      photoAlt: '食堂拉面档口',
      kind: 'all-stalls',
      shop: null,
      enterable: true,
      disabledReason: '',
    },
    {
      key: homeCard ? `slide-${homeCard.merchantId}` : 'slide-right',
      label: homeCard ? shortenPolaroidLabel(homeCard.title, '家常档') : '家常档',
      photo: stallCounterJiachang,
      photoAlt: homeCard?.title ?? '家常档口',
      kind: homeCard ? 'shop' : 'all-stalls',
      shop: rightShop,
      enterable: homeCard ? homeCard.enterable && rightShop !== null : true,
      disabledReason: homeCard?.disabledReason ?? '',
    },
  ];
}

function pickHomeDishes(
  dishes: DishDto[],
  shopOf: (merchantId: string) => ShopSummary | null,
): DishDto[] {
  const available = dishes.filter((dish) => shopOf(dish.merchantId) !== null);
  if (available.length <= 3) return available;

  const preferredOrder = [
    (dish: DishDto) => /鸡肉饭|鸡腿/.test(dish.name),
    (dish: DishDto) => /牛肉面|汤面|拉面/.test(dish.name),
    (dish: DishDto) => /香菇|青菜|番茄炒蛋饭/.test(dish.name),
  ];

  const picked: DishDto[] = [];
  for (const matcher of preferredOrder) {
    const match = available.find((dish) => matcher(dish) && !picked.some((item) => item.dishId === dish.dishId));
    if (match) picked.push(match);
  }
  for (const dish of available) {
    if (picked.length >= 3) break;
    if (!picked.some((item) => item.dishId === dish.dishId)) {
      picked.push(dish);
    }
  }
  return picked;
}

export default function HomeFeed({
  mode,
  picker,
  shops,
  dishes,
  error,
  menuLoading,
  menuError,
  notice,
  derivedBusy,
  derivedError,
  onEnterShop,
  onGoToOrderTab,
  onRetry,
  onLoadDerivedShops,
}: HomeFeedProps) {
  const [activeSlide, setActiveSlide] = useState(1);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const shopOf = (id: string) => shops.find((shop) => shop.merchantId === id) ?? null;
  const slides = buildPolaroidSlides(picker.cards, shopOf);
  const recommendedDishes = pickHomeDishes(dishes, shopOf);
  const featuredDish = recommendedDishes[0] ?? null;
  const secondaryDishes = recommendedDishes.slice(1, 3);
  const noodleShop =
    shops.find((shop) => /面|粉|饺/.test(shop.name) && shop.orderable !== false) ??
    shops.find((shop) => shop.orderable !== false) ??
    null;

  useEffect(() => {
    if (
      picker.phase !== 'ready' ||
      carouselPaused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = window.setInterval(() => setActiveSlide((index) => (index + 1) % 3), 4500);
    return () => window.clearInterval(timer);
  }, [picker.phase, carouselPaused]);

  function moveSlide(direction: -1 | 1): void {
    setActiveSlide((index) => (index + direction + 3) % 3);
  }

  function handleSlideActivate(slide: PolaroidSlide, index: number, isCenter: boolean): void {
    if (!isCenter) {
      setActiveSlide(index);
      return;
    }
    if (slide.kind === 'all-stalls') {
      onGoToOrderTab();
      return;
    }
    if (slide.enterable && slide.shop) {
      onEnterShop(slide.shop);
    }
  }

  const featuredShop = featuredDish ? shopOf(featuredDish.merchantId) : null;
  const featuredPrice = featuredDish ? formatPriceParts(featuredDish.unitPriceFen) : null;

  return (
    <div className="student-home">
      <header className="home-hero">
        <div className="home-hero__content">
          <h1 id="student-home-title" className="home-hero__brand">
            食麦呼
          </h1>
          <p className="home-hero__subtitle">校园美食发现平台</p>
        </div>
      </header>

      <div className="home-paper">
        {notice ? (
          <p className="student-notice home-notice" role="status">
            {notice}
          </p>
        ) : null}

        {/* 选择店铺 */}
        <section className="home-section" aria-labelledby="home-shops-heading">
          <div className="home-section__head">
            <div className="home-section__title-wrap">
              <h2 id="home-shops-heading" className="home-section__title">
                选择店铺
              </h2>
              <BrushUnderline />
            </div>
            <p className="home-section__hint">
              <SparkRays className="home-section__hint-spark" />
              <span>逛一逛食堂，发现更多美味</span>
            </p>
          </div>

          {picker.phase === 'loading' ? <p className="student-loading">{SHOP_LIST_LOADING}</p> : null}

          {picker.phase === 'error' && error ? (
            <div className="student-error" role="alert">
              <p>{toSourceErrorView(error)}</p>
              <button type="button" className="student-secondary" onClick={onRetry}>
                重新读取
              </button>
            </div>
          ) : null}

          {picker.phase === 'unavailable' ? (
            <div className="student-error student-shop-derived" role="alert">
              <p>{SHOP_LIST_UNAVAILABLE_TEXT}</p>
              <p className="student-order-note">{SHOP_LIST_UNAVAILABLE_HINT}</p>
              <button type="button" className="student-secondary" onClick={onRetry}>
                重新读取
              </button>
              {picker.showDerivedEntry ? (
                <>
                  <button
                    type="button"
                    className="student-secondary student-shop-derived__entry"
                    disabled={derivedBusy}
                    onClick={onLoadDerivedShops}
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
              <button type="button" className="student-secondary" onClick={onRetry}>
                重新读取
              </button>
            </div>
          ) : null}

          {picker.phase === 'ready' ? (
            <div
              className="home-carousel"
              role="region"
              aria-label="店铺拍立得轮播"
              onMouseEnter={() => setCarouselPaused(true)}
              onMouseLeave={() => setCarouselPaused(false)}
              onFocusCapture={() => setCarouselPaused(true)}
              onBlurCapture={() => setCarouselPaused(false)}
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                if (touchStartX.current === null) return;
                const distance =
                  (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
                if (Math.abs(distance) > 36) moveSlide(distance > 0 ? -1 : 1);
                touchStartX.current = null;
              }}
            >
              <ul className="home-polaroid-stage">
                {slides.map((slide, index) => {
                  const position =
                    index === activeSlide
                      ? 'center'
                      : (index - activeSlide + 3) % 3 === 1
                        ? 'right'
                        : 'left';
                  const isCenter = position === 'center';
                  const ariaLabel = isCenter
                    ? slide.kind === 'all-stalls'
                      ? '查看全部档口'
                      : `进入${slide.shop?.name ?? slide.label}点餐`
                    : `切换到${slide.label}`;

                  return (
                    <li
                      key={slide.key}
                      className={`home-polaroid-slide is-${position}`}
                    >
                      <button
                        type="button"
                        className="home-polaroid-card"
                        aria-label={ariaLabel}
                        disabled={isCenter && !slide.enterable}
                        onClick={() => handleSlideActivate(slide, index, isCenter)}
                      >
                        <span className="home-polaroid-card__frame">
                          <img src={slide.photo} alt={slide.photoAlt} />
                        </span>
                        <span className="home-polaroid-card__caption">
                          <span className="home-polaroid-card__label-wrap">
                            <span className="home-polaroid-card__label">{slide.label}</span>
                            {isCenter ? (
                              <>
                                <SparkRays className="home-polaroid-card__spark" />
                                <BrushUnderline className="home-polaroid-card__underline" />
                              </>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="home-carousel__controls">
                <button
                  type="button"
                  className="home-carousel__arrow"
                  aria-label="上一张店铺"
                  onClick={() => moveSlide(-1)}
                >
                  <ChevronLeftIcon />
                </button>
                <div className="home-carousel__dots" aria-label="店铺轮播页码">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.key}
                      type="button"
                      className={index === activeSlide ? 'is-active' : ''}
                      aria-label={`切换到${slide.label}`}
                      aria-pressed={index === activeSlide}
                      onClick={() => setActiveSlide(index)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="home-carousel__arrow"
                  aria-label="下一张店铺"
                  onClick={() => moveSlide(1)}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* 今日推荐 */}
        <section className="home-section home-section--rec" aria-labelledby="home-rec-heading">
          <div className="home-section__head">
            <div className="home-section__title-wrap">
              <h2 id="home-rec-heading" className="home-section__title">
                今日推荐
              </h2>
              <SparkRays className="home-section__title-spark" />
              <BrushUnderline />
            </div>
            <p className="home-section__aside">校园人气美食，值得一试</p>
          </div>

          {menuLoading ? (
            <p className="home-rec-empty">正在读取今日推荐…</p>
          ) : menuError ? (
            <p className="home-rec-empty">菜单暂时无法读取，请稍后再试。</p>
          ) : featuredDish === null ? (
            <p className="home-rec-empty">暂无可推荐菜品，去店铺看看菜单吧。</p>
          ) : (
            <div className="home-rec-grid">
              <button
                type="button"
                className="home-featured-card"
                disabled={featuredShop === null}
                onClick={() => {
                  if (featuredShop) onEnterShop(featuredShop);
                }}
              >
                <span className="home-featured-card__media">
                  <img
                    src={featuredDish.imageUrl ?? resolveHomeDishPhoto(featuredDish.name, 0)}
                    alt={featuredDish.name}
                  />
                  <span className="home-featured-card__badge">
                    <CrownIcon />
                    <span>人气招牌</span>
                  </span>
                </span>

                <span className="home-featured-card__body">
                  <WheatSprig />
                  <span className="home-featured-card__copy">
                    <strong className="home-featured-card__title">{featuredDish.name}</strong>
                    <span className="home-featured-card__shop">
                      {featuredShop?.name ?? '校园食堂档口'}
                    </span>
                    <span className="home-featured-card__desc">鲜嫩多汁，食堂的人气之选</span>
                  </span>
                  <span className="home-featured-card__foot">
                    <span className="home-price">
                      <em>{featuredPrice?.symbol}</em>
                      {featuredPrice?.numberText}
                    </span>
                    <span className="home-pill-cta">
                      <span>去看看</span>
                      <ChevronRightIcon />
                    </span>
                  </span>
                </span>
              </button>

              {secondaryDishes.length > 0 ? (
                <div className="home-rec-subrow">
                  {secondaryDishes.map((dish, index) => {
                    const shop = shopOf(dish.merchantId);
                    const price = formatPriceParts(dish.unitPriceFen);
                    return (
                      <button
                        key={dish.dishId}
                        type="button"
                        className="home-small-card"
                        disabled={shop === null}
                        onClick={() => {
                          if (shop) onEnterShop(shop);
                        }}
                      >
                        <span className="home-small-card__media">
                          <img
                            src={dish.imageUrl ?? resolveHomeDishPhoto(dish.name, index + 1)}
                            alt={dish.name}
                          />
                        </span>
                        <span className="home-small-card__body">
                          <strong className="home-small-card__title">{dish.name}</strong>
                          <span className="home-small-card__shop">
                            {shop?.name ?? '食堂档口'}
                          </span>
                          <span className="home-small-card__foot">
                            <span className="home-price home-price--sm">
                              <em>{price.symbol}</em>
                              {price.numberText}
                            </span>
                            <span className="home-circle-cta" aria-hidden="true">
                              <ChevronRightIcon />
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* 暖冬汤面季 */}
          <button
            type="button"
            className="home-promo-banner"
            onClick={() => {
              if (noodleShop) {
                onEnterShop(noodleShop);
              } else {
                onGoToOrderTab();
              }
            }}
          >
            <img
              className="home-promo-banner__bg"
              src={warmNoodleBanner}
              alt=""
              aria-hidden="true"
            />
            <span className="home-promo-banner__scrim" aria-hidden="true" />
            <span className="home-promo-banner__copy">
              <span className="home-promo-banner__title-row">
                <strong className="home-promo-banner__title">暖冬汤面季</strong>
                <SteamLines />
              </span>
              <span className="home-promo-banner__sub">一碗热汤面，暖胃更暖心</span>
            </span>
            <span className="home-pill-cta home-promo-banner__cta">
              <span>去看看</span>
              <ChevronRightIcon />
            </span>
          </button>
        </section>

        {mode === 'sample' ? (
          <div className="home-mode-footer">
            <DemoModeNotice />
          </div>
        ) : null}
      </div>
    </div>
  );
}
