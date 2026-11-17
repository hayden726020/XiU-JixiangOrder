import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createStudentSource } from './data/sampleSource';
import { resolveStudentMode } from './data/mode';
import { createOrderDraft } from './state/orderDraft';
import {
  clearDraftSnapshot,
  readDraftSnapshot,
  saveDraftSnapshot,
  type DraftSelection,
} from './state/draftSnapshot';
import ConfirmPage from './pages/ConfirmPage';
import MenuPage from './pages/MenuPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderListPage from './pages/OrderListPage';
import ShopSelectPage from './pages/ShopSelectPage';
import SlotDiningPage from './pages/SlotDiningPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import { useStudentSessionGate } from './state/useStudentSessionGate';
import type { ShopSummary, StudentMode, StudentSource } from './types';
import { SHOP_SWITCH_BUSY } from './utils/shopTexts';
import { todayAndTomorrow } from './utils/dates';
import './student.css';
import './student-global.css';

const MODE_OVERRIDE_KEY = 'xiu.student.modeOverride.v1';

function readModeOverride(): StudentMode | null {
  try {
    const value = window.localStorage.getItem(MODE_OVERRIDE_KEY);
    return value === 'real' || value === 'sample' ? value : null;
  } catch {
    return null;
  }
}

function writeModeOverride(mode: StudentMode): void {
  try {
    window.localStorage.setItem(MODE_OVERRIDE_KEY, mode);
  } catch {
    return;
  }
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: StudentMode;
  onChange: (next: StudentMode) => void;
}) {
  return (
    <div className="student-mode-switch" role="group" aria-label="数据模式切换">
      <button
        type="button"
        className={`student-mode-switch__item${mode === 'sample' ? ' is-active' : ''}`}
        aria-pressed={mode === 'sample'}
        onClick={() => onChange('sample')}
      >
        演示模式
      </button>
      <button
        type="button"
        className={`student-mode-switch__item${mode === 'real' ? ' is-active' : ''}`}
        aria-pressed={mode === 'real'}
        onClick={() => onChange('real')}
      >
        真实模式
      </button>
    </div>
  );
}

type StudentView = 'shop' | 'menu' | 'slot' | 'confirm' | 'order' | 'orders' | 'profile';

type DetailFrom = 'menu' | 'orders';

type OrdersBackTo = 'shop' | 'menu';

export default function StudentHome() {
  const [mode, setMode] = useState<StudentMode>(() => readModeOverride() ?? resolveStudentMode());
  const { gate } = useStudentSessionGate();

  function switchMode(next: StudentMode): void {
    if (next === mode) {
      return;
    }
    writeModeOverride(next);
    setMode(next);
  }

  return (
    <>
      <ModeSwitch mode={mode} onChange={switchMode} />
      {mode === 'real' && !gate.usable ? (
        <LoginPage gate={gate} />
      ) : (
        <StudentHomeApp key={mode} mode={mode} />
      )}
    </>
  );
}

function StudentHomeApp({ mode }: { mode: StudentMode }) {
  useEffect(() => {
    document.documentElement.dataset.studentSurface = '';
    return () => {
      delete document.documentElement.dataset.studentSurface;
    };
  }, []);

  const [source] = useState<StudentSource>(() => createStudentSource({ mode }));
  const [pendingSnapshot] = useState<DraftSelection | null>(() => {
    if (source.mode === 'real') {
      return readDraftSnapshot({ allowedDates: todayAndTomorrow(new Date()) });
    }
    return null;
  });
  const [draft] = useState(() => {
    if (source.mode === 'real') {
      const dates = todayAndTomorrow(new Date());
      return createOrderDraft({
        source,
        allowedDates: dates,
        initialDate: dates[0],
        onChange: (snapshot) => {
          if (
            snapshot.status === 'success' ||
            snapshot.totalQuantity === 0 ||
            snapshot.shopId === null
          ) {
            clearDraftSnapshot();
            return;
          }
          saveDraftSnapshot({
            merchantId: snapshot.shopId,
            date: snapshot.date,
            items: snapshot.items,
            slotId: snapshot.slotId,
            diningMode: snapshot.diningMode,
          });
        },
      });
    }
    return createOrderDraft({ source });
  });
  const [view, setView] = useState<StudentView>('shop');
  const [shopLandingTab, setShopLandingTab] = useState<'home' | 'order'>('home');
  const [currentShop, setCurrentShop] = useState<ShopSummary | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [detailFrom, setDetailFrom] = useState<DetailFrom>('menu');
  const [ordersBackTo, setOrdersBackTo] = useState<OrdersBackTo>('shop');
  const [shopNotice, setShopNotice] = useState('');

  function goTo(next: StudentView): void {
    const commit = () => {
      setView(next);
      window.scrollTo(0, 0);
    };
    if (
      next === view ||
      document.documentElement.dataset.navDirection ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      commit();
      return;
    }

    if (document.startViewTransition) {
      const root = document.documentElement;
      const transitionId = String(performance.now());
      root.dataset.studentPageAnimating = transitionId;
      try {
        const transition = document.startViewTransition(() => flushSync(commit));
        const clearMarker = () => {
          if (root.dataset.studentPageAnimating === transitionId) {
            delete root.dataset.studentPageAnimating;
          }
        };
        void transition.finished.then(clearMarker, clearMarker);
      } catch {
        delete root.dataset.studentPageAnimating;
        commit();
      }
    } else {
      commit();
      document.documentElement.dataset.studentNavFallback = '';
      window.setTimeout(() => {
        delete document.documentElement.dataset.studentNavFallback;
      }, 220);
    }
  }

  function goToShop(tab: 'home' | 'order' = 'home'): void {
    setShopLandingTab(tab);
    goTo('shop');
  }

  function openOrder(id: string): void {
    setOrderId(id);
    goTo('order');
  }

  function openOrderFrom(from: DetailFrom, id: string): void {
    setDetailFrom(from);
    openOrder(id);
  }

  function enterShop(shop: ShopSummary): void {
    const result = draft.setShop(shop.merchantId);
    if (result.reason === 'busy') {
      setShopNotice(SHOP_SWITCH_BUSY);
      goTo('shop');
      return;
    }
    if (!result.ok) {
      return;
    }
    if (result.changed) {
      clearDraftSnapshot();
      if (pendingSnapshot !== null && pendingSnapshot.merchantId === shop.merchantId) {
        draft.restoreSelection(pendingSnapshot);
      }
    }
    setCurrentShop(shop);
    setShopNotice('');
    goTo('menu');
  }

  function openOrders(from: OrdersBackTo): void {
    setOrdersBackTo(from);
    goTo('orders');
  }

  if (currentShop === null && view === 'orders') {
    return (
      <OrderListPage
        source={source}
        onBack={() => goToShop('home')}
        backLabel="← 返回店铺选择"
        onOpenOrder={(id) => openOrderFrom('orders', id)}
        onGoToHome={() => goToShop('home')}
        onGoToShop={() => goToShop('order')}
        onGoToProfile={() => goTo('profile')}
      />
    );
  }

  if (currentShop === null && view === 'order' && orderId !== null) {
    return (
      <OrderDetailPage
        source={source}
        orderId={orderId}
        onBack={() => goTo('orders')}
        backLabel="← 返回我的订单"
        onGoToHome={() => goToShop('home')}
        onGoToShop={() => goToShop('order')}
        onGoToOrders={() => goTo('orders')}
        onGoToProfile={() => goTo('profile')}
      />
    );
  }

  if (view === 'profile') {
    return (
      <ProfilePage
        source={source}
        onOpenOrders={() => openOrders('shop')}
        onGoToShop={() => goToShop('home')}
        onGoToMenu={() => {
          if (currentShop) {
            goTo('menu');
          } else {
            source.listShops().then((shops) => {
              if (shops.length > 0) enterShop(shops[0]);
              else goToShop('home');
            });
          }
        }}
      />
    );
  }

  if (currentShop === null || view === 'shop') {
    return (
      <ShopSelectPage
        source={source}
        draft={draft}
        currentShop={currentShop}
        notice={shopNotice || draft.getState().notice || ''}
        initialTab={shopLandingTab}
        onEnterShop={enterShop}
        onOpenOrders={() => openOrders('shop')}
        onOpenProfile={() => goTo('profile')}
      />
    );
  }

  if (view === 'slot') {
    return (
      <SlotDiningPage
        source={source}
        draft={draft}
        shop={currentShop}
        onBack={() => goTo('menu')}
        onConfirm={() => goTo('confirm')}
      />
    );
  }

  if (view === 'confirm') {
    return (
      <ConfirmPage
        source={source}
        draft={draft}
        shop={currentShop}
        onBack={() => goTo('slot')}
        onBackToMenu={() => goTo('menu')}
        onSubmitted={(id) => openOrderFrom('menu', id)}
      />
    );
  }

  if (view === 'orders') {
    const backToShops = ordersBackTo === 'shop';
    return (
      <OrderListPage
        source={source}
        onBack={() => goTo(backToShops ? 'shop' : 'menu')}
        backLabel={backToShops ? '← 返回店铺选择' : '← 返回菜单'}
        onOpenOrder={(id) => openOrderFrom('orders', id)}
        onGoToHome={() => goToShop('home')}
        onGoToShop={() => goToShop('order')}
        onGoToProfile={() => goTo('profile')}
      />
    );
  }

  if (view === 'order' && orderId !== null) {
    const backTarget: StudentView = detailFrom === 'orders' ? 'orders' : 'menu';
    return (
      <OrderDetailPage
        source={source}
        orderId={orderId}
        onBack={() => goTo(backTarget)}
        backLabel={detailFrom === 'orders' ? '← 返回我的订单' : '← 返回菜单'}
        onGoToHome={() => goToShop('home')}
        onGoToShop={() => goToShop('order')}
        onGoToOrders={() => goTo('orders')}
        onGoToProfile={() => goTo('profile')}
      />
    );
  }

  return (
    <MenuPage
      source={source}
      draft={draft}
      shop={currentShop}
      onBackToShops={() => goToShop('home')}
      onProceed={() => goTo('slot')}
      onOpenOrders={() => openOrders('menu')}
      onOpenProfile={() => goTo('profile')}
    />
  );
}
