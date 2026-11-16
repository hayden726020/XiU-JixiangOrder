import { useEffect, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import type { DishDto, MenuResponse, ShopSummary, StudentSource } from '../types';
import { SAMPLE_ONLY_DISH_IDS } from '../data/sampleData';
import { filterDishesByShop } from '../utils/dishShopFilter';
import { toDishView } from '../utils/dishView';
import { formatYuan } from '../utils/money';
import { toSourceErrorView } from '../utils/sourceErrorView';
import { DISH_LIMIT_TEXT } from '../utils/submitTexts';
import {
  CURRENT_SHOP_PREFIX,
  EMPTY_SHOP_MENU,
  SAMPLE_ONLY_LABEL,
  SHOP_SWITCH_BUSY,
} from '../utils/shopTexts';
import SampleBanner from '../components/SampleBanner';
import StudentTabBar from '../components/StudentTabBar';
import '../menu-page.css';

type LoadStatus = 'loading' | 'ready' | 'error';

const DAY_LABELS = ['今天', '明天'];

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}-${day}`;
}

export interface MenuPageProps {
  source: StudentSource;
  draft: OrderDraft;
  shop: ShopSummary;
  onBackToShops: () => void;
  onProceed: () => void;
  onOpenOrders: () => void;
  onOpenProfile: () => void;
}

export default function MenuPage({
  source,
  draft,
  shop,
  onBackToShops,
  onProceed,
  onOpenOrders,
  onOpenProfile,
}: MenuPageProps) {
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const date = snapshot.date;

  useEffect(() => {
    let cancelled = false;
    const token = draft.beginMenuRead();
    setStatus('loading');
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (cancelled || !draft.isMenuReadCurrent(token)) {
          return;
        }
        setMenu(data);
        setStatus('ready');
        draft.applyDishCatalog(filterDishesByShop(data.dishes, shop.merchantId));
      },
      (error: unknown) => {
        if (cancelled || !draft.isMenuReadCurrent(token)) {
          return;
        }
        setMenu(null);
        setStatus('error');
        setErrorText(toSourceErrorView(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, draft, shop.merchantId, date, reloadToken]);

  function changeDate(next: string): void {
    if (!draft.setDate(next)) {
      return;
    }
    setMenu(null);
    setStatus('loading');
    setSnapshot(draft.getState());
  }

  function updateQuantity(dish: DishDto, next: number): void {
    draft.setQuantity(dish, next);
    setSnapshot(draft.getState());
  }

  const canSwitchShop = draft.canSetShop();
  const shopDishes = menu ? filterDishesByShop(menu.dishes, shop.merchantId) : [];
  const canProceed = snapshot.canProceedToSlot;

  return (
    <section className="student-menu-page student-page" aria-labelledby="student-menu-title">
      {source.mode === 'sample' ? <SampleBanner /> : null}

      <button
        type="button"
        className="student-secondary student-back"
        disabled={!canSwitchShop}
        onClick={onBackToShops}
      >
        ← 返回店铺选择
      </button>
      {!canSwitchShop ? (
        <p className="student-order-note" role="status">
          {SHOP_SWITCH_BUSY}
        </p>
      ) : null}

      <p
        className="student-shop-title"
        data-shop-demo={source.mode === 'sample' ? 'true' : 'false'}
      >
        {CURRENT_SHOP_PREFIX}：{shop.name}
      </p>

      <header className="student-page__head">
        <p className="student-kicker">
          {source.mode === 'real' ? '好味道，今天也安排上' : '挑选喜欢的菜品'}
        </p>
        <h2 id="student-menu-title">学生点餐</h2>
        {source.mode === 'real' ? (
          <section className="student-order-entry" aria-label="我的订单入口">
            <button type="button" className="student-secondary" onClick={onOpenOrders}>
              我的订单
            </button>
          </section>
        ) : null}
        <p className="student-page__lead">
          挑选喜欢的菜品，开启今天的好胃口。
        </p>
      </header>

      <div className="student-date-switch" role="group" aria-label="选择菜单日期">
        {snapshot.allowedDates.map((item, index) => (
          <button
            key={item}
            type="button"
            className={`student-date-switch__item${date === item ? ' is-active' : ''}`}
            aria-pressed={date === item}
            onClick={() => changeDate(item)}
          >
            {DAY_LABELS[index]} {formatMonthDay(item)}
          </button>
        ))}
      </div>

      {snapshot.notice ? (
        <p className="student-notice" role="status">
          {snapshot.notice}
        </p>
      ) : null}

      {status === 'loading' ? (
        <p className="student-loading">
          {source.mode === 'real' ? '正在读取菜单…' : '正在读取样例菜单…'}
        </p>
      ) : null}

      {status === 'error' ? (
        <div className="student-error" role="alert">
          <p>{errorText}</p>
          <button type="button" className="student-secondary" onClick={() => setReloadToken((value) => value + 1)}>
            重新读取
          </button>
        </div>
      ) : null}

      {status === 'ready' && menu && menu.dishes.length === 0 ? (
        <p className="student-loading">暂无菜单信息，请稍后重试</p>
      ) : null}

      {status === 'ready' && menu && menu.dishes.length > 0 && shopDishes.length === 0 ? (
        <p className="student-loading">{EMPTY_SHOP_MENU}</p>
      ) : null}

      {status === 'ready' && shopDishes.length > 0 ? (
        <ul
          className="student-dish-list"
          aria-label={`${formatMonthDay(menu?.date ?? date)} ${
            source.mode === 'real' ? '菜品' : '样例菜品'
          }`}
        >
          {shopDishes.map((dish) => {
            const quantity = snapshot.items.find((item) => item.dishId === dish.dishId)?.quantity ?? 0;
            const view = toDishView(dish);
            const limit = dish.onSale === true ? Math.max(0, dish.availableQuantity ?? 0) : 0;
            const atLimit = view.kind === 'ON_SALE' && quantity >= limit;
            const sampleOnly = source.mode === 'sample' && SAMPLE_ONLY_DISH_IDS.includes(dish.dishId);
            return (
              <li
                key={dish.dishId}
                data-dish-id={dish.dishId}
                data-merchant-id={dish.merchantId}
                className={`student-dish${
                  view.kind === 'OFF_SALE' ? ' is-off' : view.kind === 'SHORTAGE' ? ' is-shortage' : ''
                }`}
              >
                <div className="student-dish__body">
                  <p className="student-dish__name">
                    {dish.name}
                    {sampleOnly ? (
                      <span className="student-sample-only">{SAMPLE_ONLY_LABEL}</span>
                    ) : null}
                  </p>
                  {view.kind === 'SHORTAGE' ? (
                    <button
                      type="button"
                      className="student-dish__shortage"
                      aria-label={`${dish.name} ${view.metaText}，查看提示`}
                      onClick={() => updateQuantity(dish, 1)}
                    >
                      {view.metaText}
                    </button>
                  ) : (
                    <p className="student-dish__meta">{view.metaText}</p>
                  )}
                  {atLimit ? <p className="student-dish__limit">{DISH_LIMIT_TEXT}</p> : null}
                </div>
                <div className="student-dish__aside">
                  <span className="student-dish__price">{formatYuan(dish.unitPriceFen)}</span>
                  {view.stepperVisible ? (
                    <div className="student-stepper" role="group" aria-label={`${dish.name} 数量`}>
                      <button
                        type="button"
                        className="student-stepper__button"
                        aria-label={`减少 ${dish.name}`}
                        disabled={quantity <= 0}
                        onClick={() => updateQuantity(dish, quantity - 1)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                      </button>
                      <span className="student-stepper__value" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        className="student-stepper__button"
                        aria-label={`增加 ${dish.name}`}
                        disabled={atLimit}
                        onClick={() => updateQuantity(dish, quantity + 1)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <footer className="student-summary">
        <p className="student-summary__main">
          {snapshot.totalQuantity > 0
            ? `共 ${snapshot.totalQuantity} 份 · 合计 ${formatYuan(snapshot.previewFen)}`
            : '共 0 份 · 合计 ¥0.00'}
        </p>
        <p className="student-summary__note">最终金额以确认订单为准</p>
        <button
          type="button"
          className="student-primary"
          disabled={!canProceed}
          onClick={onProceed}
        >
          选时段 ›
        </button>
        <p className="student-summary__hint">
          {canProceed ? '已选内容会带入时段页。' : '请先选择菜品'}
        </p>
      </footer>

      <StudentTabBar
        active="order"
        onGoHome={onBackToShops}
        onGoOrder={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onOpenOrders={onOpenOrders}
        onOpenProfile={onOpenProfile}
      />
    </section>
  );
}
