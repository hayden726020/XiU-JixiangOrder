import { useEffect, useRef, useState } from 'react';
import { createStudentSource } from './data/sampleSource';
import { resolveStudentMode, writeStudentModeOverride } from './data/mode';
import { createOrderDraft } from './state/orderDraft';
import {
  clearDraftSnapshot,
  readDraftSnapshot,
  saveDraftSnapshot,
  type DraftSelection,
} from './state/draftSnapshot';
import LoginPage from './pages/LoginPage';
import ConfirmPage from './pages/ConfirmPage';
import MenuPage from './pages/MenuPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderListPage, { type OrderFilter } from './pages/OrderListPage';
import ShopSelectPage from './pages/ShopSelectPage';
import SlotDiningPage from './pages/SlotDiningPage';
import ProfilePage from './pages/ProfilePage';
import { useStudentSessionGate } from './state/useStudentSessionGate';
import type { ShopSummary, StudentMode, StudentSource } from './types';
import { SHOP_SWITCH_BUSY } from './utils/shopTexts';
import { todayAndTomorrow } from './utils/dates';
import { filterDishesByShop } from './utils/dishShopFilter';
import './student.css';

type StudentView = 'shop' | 'menu' | 'slot' | 'confirm' | 'order' | 'orders' | 'profile';

type DetailFrom = 'menu' | 'orders';

type OrdersBackTo = 'shop' | 'menu' | 'profile';

const VIEW_HASH: Record<StudentView, string> = {
  shop: '#/student',
  menu: '#/student/menu',
  slot: '#/student/slot',
  confirm: '#/student/confirm',
  order: '#/student/order',
  orders: '#/student/orders',
  profile: '#/student/profile',
};

function viewHash(view: StudentView): string {
  return VIEW_HASH[view];
}

function previewSlotRequested(): boolean {
  if (new URLSearchParams(window.location.search).get('preview') === 'slot') {
    return true;
  }
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('preview') === 'slot';
}

export default function StudentHome() {
  const [mode, setMode] = useState<StudentMode>(() => resolveStudentMode());
  const { gate } = useStudentSessionGate();
  const sampleMode = mode === 'sample';
  const previewSlot = sampleMode && previewSlotRequested();

  function handleSwitchMode(next: StudentMode): void {
    writeStudentModeOverride(next);
    setMode(next);
  }

  if (!gate.usable && !sampleMode) {
    return (
      <LoginPage
        gate={gate}
        onSwitchToSample={() => handleSwitchMode('sample')}
      />
    );
  }

  return (
    <StudentHomeApp
      key={mode}
      mode={mode}
      previewSlot={previewSlot}
      onSwitchMode={handleSwitchMode}
    />
  );
}

function StudentHomeApp({
  mode,
  previewSlot,
  onSwitchMode,
}: {
  mode: StudentMode;
  previewSlot: boolean;
  onSwitchMode: (next: StudentMode) => void;
}) {
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
  const [shopTab, setShopTab] = useState<'home' | 'order'>('home');
  const [currentShop, setCurrentShop] = useState<ShopSummary | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [detailFrom, setDetailFrom] = useState<DetailFrom>('menu');
  const [ordersBackTo, setOrdersBackTo] = useState<OrdersBackTo>('shop');
  const [ordersFilter, setOrdersFilter] = useState<OrderFilter>('all');
  const [shopNotice, setShopNotice] = useState('');
  const previewStarted = useRef(false);
  const pendingShopTabRef = useRef<'home' | 'order' | null>(null);

  useEffect(() => {
    if (!previewSlot || previewStarted.current) return;
    previewStarted.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const shops = await source.listShops();
        if (cancelled || shops.length === 0) return;
        const shop = shops[0];
        const entered = draft.setShop(shop.merchantId);
        if (!entered.ok) return;
        const menu = await source.getMenu(draft.getState().date);
        if (cancelled) return;
        const dishes = filterDishesByShop(menu.dishes, shop.merchantId);
        draft.applyDishCatalog(dishes);
        const dish = dishes.find((item) => item.onSale === true && item.availableQuantity > 0);
        if (dish) draft.setQuantity(dish, 1);
        setCurrentShop(shop);
        goTo('slot');
      } catch {
        setShopNotice('样例预览未能自动进入预约页，请手动选择店铺。');
      }
    })();
    return () => { cancelled = true; };
  }, [previewSlot, source, draft]);

  function goTo(
    next: StudentView,
    nav: 'push' | 'back' = 'push',
    nextShopTab: 'home' | 'order' = shopTab,
  ): void {
    if (nav === 'back') {
      window.history.back();
      return;
    }
    window.history.pushState(
      { module: 'student', studentView: next, shopTab: nextShopTab },
      '',
      viewHash(next),
    );
    setView(next);
    window.scrollTo(0, 0);
  }

  function replaceTo(next: StudentView, nextShopTab: 'home' | 'order' = shopTab): void {
    window.history.replaceState(
      { module: 'student', studentView: next, shopTab: nextShopTab },
      '',
      viewHash(next),
    );
    setView(next);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    window.history.replaceState(
      { module: 'student', studentView: 'shop', shopTab: 'home' },
      '',
      viewHash('shop'),
    );
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as {
        module?: string;
        studentView?: StudentView;
        shopTab?: 'home' | 'order';
      } | null;
      if (state && state.module === 'student') {
        if (pendingShopTabRef.current !== null) {
          setShopTab(pendingShopTabRef.current);
          pendingShopTabRef.current = null;
        } else if (state.shopTab === 'home' || state.shopTab === 'order') {
          setShopTab(state.shopTab);
        }
        setView(state.studentView ?? 'shop');
      } else {
        setView('shop');
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

  function openOrders(from: OrdersBackTo, filter: OrderFilter = 'all'): void {
    setOrdersBackTo(from);
    setOrdersFilter(filter);
    goTo('orders');
  }

  if (view === 'profile') {
    return (
      <ProfilePage
        source={source}
        onSwitchMode={onSwitchMode}
        onOpenOrders={(filter) => openOrders('profile', filter)}
        onOpenOrder={(id) => openOrderFrom('orders', id)}
        onGoToShop={() => {
          setShopTab('home');
          goTo('shop', 'push', 'home');
        }}
        onGoToMenu={() => {
          setShopTab('order');
          goTo('shop', 'push', 'order');
        }}
      />
    );
  }

  if (view === 'orders') {
    const backToProfile = ordersBackTo === 'profile';
    const backToShops = !backToProfile && (ordersBackTo === 'shop' || currentShop === null);
    return (
      <OrderListPage
        source={source}
        onBack={() => goTo(backToProfile ? 'profile' : backToShops ? 'shop' : 'menu', 'back')}
        backLabel={backToProfile ? '← 返回我的' : backToShops ? '← 返回店铺选择' : '← 返回菜单'}
        initialFilter={ordersFilter}
        onOpenOrder={(id) => openOrderFrom('orders', id)}
        onGoToHome={() => {
          setShopTab('home');
          goTo('shop', 'push', 'home');
        }}
        onGoToShop={() => {
          setShopTab('order');
          goTo('shop', 'push', 'order');
        }}
        onGoToProfile={() => goTo('profile')}
      />
    );
  }

  if (view === 'order' && orderId !== null) {
    const backTarget: StudentView =
      detailFrom === 'orders' || currentShop === null ? 'orders' : 'menu';
    return (
      <OrderDetailPage
        source={source}
        orderId={orderId}
        onBack={() => goTo(backTarget, 'back')}
        backLabel={backTarget === 'orders' ? '← 返回我的订单' : '← 返回菜单'}
        onGoToHome={() => {
          setShopTab('home');
          goTo('shop', 'push', 'home');
        }}
        onGoToShop={() => {
          setShopTab('order');
          goTo('shop', 'push', 'order');
        }}
        onGoToOrders={() => goTo('orders')}
        onGoToProfile={() => goTo('profile')}
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
        activeTab={shopTab}
        onTabChange={(nextTab) => {
          setShopTab(nextTab);
          window.history.replaceState({ module: 'student', studentView: 'shop', shopTab: nextTab }, '');
        }}
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
        onBack={() => goTo('menu', 'back')}
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
        onBack={() => goTo('slot', 'back')}
        onBackToMenu={() => goTo('menu', 'back')}
        onSubmitted={(id) => { setDetailFrom('menu'); setOrderId(id); replaceTo('order'); }}
      />
    );
  }

  return (
    <MenuPage
      source={source}
      draft={draft}
      shop={currentShop}
      onBackToShops={() => {
        pendingShopTabRef.current = 'order';
        setShopTab('order');
        goTo('shop', 'back');
      }}
      onProceed={() => goTo('slot')}
      onViewSampleOrder={() => openOrderFrom('menu', 'demo-order-001')}
      onViewCancelOrder={() => openOrderFrom('menu', 'demo-order-cancel-001')}
      onOpenOrders={() => openOrders('menu')}
      onGoHome={() => {
        setShopTab('home');
        goTo('shop', 'push', 'home');
      }}
      onGoProfile={() => goTo('profile')}
    />
  );
}
