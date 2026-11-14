import { useEffect, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import type { DishDto, MenuResponse, StudentSource } from '../types';
import { toDishView } from '../utils/dishView';
import { formatYuan } from '../utils/money';
import { toSourceErrorView } from '../utils/sourceErrorView';
import { DISH_LIMIT_TEXT } from '../utils/submitTexts';
import DemoModeNotice from '../components/DemoModeNotice';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';

type LoadStatus = 'loading' | 'ready' | 'error';

const DAY_LABELS = ['今天', '明天'];

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}-${day}`;
}

export interface MenuPageProps {
  source: StudentSource;
  draft: OrderDraft;
  onProceed: () => void;
  onViewSampleOrder: () => void;
}

export default function MenuPage({
  source,
  draft,
  onProceed,
  onViewSampleOrder,
}: MenuPageProps) {
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const date = snapshot.date;

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (!cancelled) {
          setMenu(data);
          setStatus('ready');
          draft.applyDishCatalog(data.dishes);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setMenu(null);
          setStatus('error');
          setErrorText(toSourceErrorView(error));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, date, reloadToken]);

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

  return (
    <section className="student-page" aria-labelledby="student-menu-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <header className="student-page__head">
        <p className="student-kicker">
          {source.mode === 'real' ? 'S9 · 真实菜单与数量（只读）' : 'S5 · 样例菜单与数量（可进入确认页）'}
        </p>
        <h2 id="student-menu-title">学生点餐</h2>
        <p className="student-page__lead">
          {source.mode === 'real'
            ? '菜品、价格与可售数量来自公共服务；金额以下单结果为准。'
            : '样例菜单可调整数量，全部数据来自模块内样例源。'}
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

      {status === 'ready' && menu && menu.dishes.length > 0 ? (
        <ul
          className="student-dish-list"
          aria-label={`${formatMonthDay(menu.date)} ${source.mode === 'real' ? '菜品' : '样例菜品'}`}
        >
          {menu.dishes.map((dish) => {
            const quantity = snapshot.items.find((item) => item.dishId === dish.dishId)?.quantity ?? 0;
            const view = toDishView(dish);
            const limit = dish.onSale === true ? Math.max(0, dish.availableQuantity ?? 0) : 0;
            const atLimit = view.kind === 'ON_SALE' && quantity >= limit;
            return (
              <li
                key={dish.dishId}
                className={`student-dish${
                  view.kind === 'OFF_SALE' ? ' is-off' : view.kind === 'SHORTAGE' ? ' is-shortage' : ''
                }`}
              >
                <div className="student-dish__body">
                  <p className="student-dish__name">{dish.name}</p>
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
                        −
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
                        +
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
            ? `已选 ${snapshot.totalQuantity} 份 · 预估 ${formatYuan(snapshot.previewFen)}`
            : '尚未选择菜品'}
        </p>
        <p className="student-summary__note">预估仅用于预览，金额以服务端返回为准</p>
        <button
          type="button"
          className="student-primary"
          disabled={!snapshot.canProceedToSlot}
          onClick={onProceed}
        >
          下一步：选择时段
        </button>
        <p className="student-summary__hint">
          {snapshot.canProceedToSlot ? '已选内容会带入时段页。' : '请先选择菜品'}
        </p>
      </footer>

      {source.mode === 'sample' ? (
        <button
          type="button"
          className="student-secondary student-sample-order"
          onClick={onViewSampleOrder}
        >
          查看样例订单
        </button>
      ) : null}

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </section>
  );
}