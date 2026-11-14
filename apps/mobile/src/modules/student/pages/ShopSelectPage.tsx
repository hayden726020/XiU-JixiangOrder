import { useEffect, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import { deriveShopAuthGate } from '../utils/shopAuthView';
import type { ShopSummary, SourceError, StudentSource } from '../types';
import { toSourceError } from '../types';
import { buildMenuDerivedShops } from '../utils/dishShopFilter';
import {
  deriveShopPickerState,
  type ShopListSource,
  type ShopPickerState,
} from '../utils/shopSelectView';
import { toSourceErrorView } from '../utils/sourceErrorView';
import {
  DERIVED_ENTRY_LABEL,
  DERIVED_ENTRY_NOTE,
  SHOP_LIST_LOADING,
  SHOP_LIST_UNAVAILABLE_HINT,
  SHOP_LIST_UNAVAILABLE_TEXT,
  SHOP_PICKER_LEAD,
  SHOP_PICKER_TITLE,
} from '../utils/shopTexts';
import DemoModeNotice from '../components/DemoModeNotice';
import LoginGuide from '../components/LoginGuide';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';

export interface ShopSelectPageProps {
  source: StudentSource;
  draft: OrderDraft;
  currentShop: ShopSummary | null;
  notice: string;
  onEnterShop: (shop: ShopSummary) => void;
  onOpenOrders: () => void;
}

export default function ShopSelectPage({
  source,
  draft,
  currentShop,
  notice,
  onEnterShop,
  onOpenOrders,
}: ShopSelectPageProps) {
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SourceError | null>(null);
  const [listSource, setListSource] = useState<ShopListSource>('server');
  const [reloadToken, setReloadToken] = useState(0);
  const [derivedBusy, setDerivedBusy] = useState(false);
  const [derivedError, setDerivedError] = useState('');
  const [recheckNotice, setRecheckNotice] = useState(false);
  const { gate, refresh } = useStudentSessionGate();

  useEffect(() => {
    let cancelled = false;
    if (source.mode === 'real' && !gate.usable) {
      setLoading(false);
      setShops([]);
      setError(null);
      setListSource('server');
      return;
    }
    setLoading(true);
    setError(null);
    setDerivedError('');
    setListSource('server');
    source.listShops().then(
      (data) => {
        if (cancelled) {
          return;
        }
        setShops(data);
        setListSource(source.mode === 'sample' ? 'demo' : 'server');
        setLoading(false);
      },
      (failure: unknown) => {
        if (cancelled) {
          return;
        }
        setShops([]);
        setError(toSourceError(failure));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, reloadToken, gate.usable]);

  async function loadDerivedShops(): Promise<void> {
    if (derivedBusy) {
      return;
    }
    setDerivedBusy(true);
    setDerivedError('');
    try {
      const data = await source.getMenu(draft.getState().date);
      const derived = buildMenuDerivedShops(data.dishes);
      setShops(derived);
      setError(null);
      setListSource('menu-derived');
    } catch (failure) {
      setDerivedError(toSourceErrorView(failure));
    } finally {
      setDerivedBusy(false);
    }
  }

  useEffect(() => {
    if (gate.usable) {
      setRecheckNotice(false);
    }
  }, [gate.usable]);

  const picker: ShopPickerState = deriveShopPickerState({
    shops,
    loading,
    error,
    mode: source.mode,
    currentShopId: currentShop?.merchantId ?? null,
    canSetShop: draft.canSetShop(),
    listSource,
  });

  const authGate = deriveShopAuthGate({
    mode: source.mode,
    gate,
    error,
    recheckNotice,
  });

  function handleRecheck(): void {
    setRecheckNotice(true);
    refresh();
  }

  function shopOf(merchantId: string): ShopSummary | null {
    return shops.find((shop) => shop.merchantId === merchantId) ?? null;
  }

  return (
    <section className="student-page" aria-labelledby="student-shop-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <header className="student-page__head">
        <p className="student-kicker">S14 · 首页选择店铺</p>
        <h2 id="student-shop-title">{SHOP_PICKER_TITLE}</h2>
        <p className="student-page__lead">{SHOP_PICKER_LEAD}</p>
      </header>

      {source.mode === 'real' ? (
        <section className="student-order-entry" aria-label="我的订单入口">
          <button type="button" className="student-secondary" onClick={onOpenOrders}>
            我的订单
          </button>
          <p className="student-order-entry__hint">查看本人在公共服务的订单，只读</p>
        </section>
      ) : null}

      {authGate.active ? (
        <LoginGuide
          gate={gate}
          reason={authGate.reason ?? undefined}
          notice={authGate.notice}
          showBack={false}
          scope="shop"
          onRecheck={handleRecheck}
          onBack={() => {}}
        />
      ) : null}

      {!authGate.active && notice ? (
        <p className="student-notice" role="status">
          {notice}
        </p>
      ) : null}

      {!authGate.active && picker.phase === 'loading' ? <p className="student-loading">{SHOP_LIST_LOADING}</p> : null}

      {!authGate.active && picker.phase === 'error' && error ? (
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

      {!authGate.active && picker.phase === 'unavailable' ? (
        <div className="student-error student-shop-derived" role="alert">
          <p>{SHOP_LIST_UNAVAILABLE_TEXT}</p>
          <p className="student-order-note">{SHOP_LIST_UNAVAILABLE_HINT}</p>
          <div className="student-error__actions">
            <button
              type="button"
              className="student-secondary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              重新读取
            </button>
          </div>
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

      {!authGate.active && picker.phase === 'empty' ? (
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

      {!authGate.active && picker.phase === 'ready' ? (
        <ul className="student-shop-grid" aria-label="店铺列表">
          {picker.cards.map((card) => {
            const shop = shopOf(card.merchantId);
            return (
              <li key={card.merchantId}>
                <div
                  className={`student-shop-card${card.isCurrent ? ' is-current' : ''}`}
                  data-demo={card.demo ? 'true' : 'false'}
                  data-shop-source={picker.listSource}
                  data-merchant-id={card.merchantId}
                >
                  <div className="student-shop-card__head">
                    <p className="student-shop-card__name">{card.title}</p>
                    {card.demoLabel ? (
                      <span className="student-shop-card__demo">{card.demoLabel}</span>
                    ) : null}
                    {card.isCurrent ? (
                      <span className="student-shop-card__current">当前店铺</span>
                    ) : null}
                  </div>
                  {card.nameNote ? <p className="student-shop-card__note">{card.nameNote}</p> : null}
                  <p className="student-shop-card__meta">
                    {card.canteenText} · {card.orderableText}
                  </p>
                  <button
                    type="button"
                    className="student-primary student-shop-card__enter"
                    disabled={!card.enterable || shop === null}
                    onClick={() => {
                      if (shop !== null) {
                        onEnterShop(shop);
                      }
                    }}
                  >
                    {card.isCurrent ? '继续在这家店点餐' : '进入店铺'}
                  </button>
                  {card.disabledReason ? (
                    <p className="student-shop-card__disabled">{card.disabledReason}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </section>
  );
}