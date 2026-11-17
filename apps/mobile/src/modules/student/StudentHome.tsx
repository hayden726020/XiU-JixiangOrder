import { useEffect, useRef, useState } from 'react';
import { createStudentSource } from './data/sampleSource';
import { resolveStudentMode } from './data/mode';
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
import OrderListPage from './pages/OrderListPage';
import ShopSelectPage from './pages/ShopSelectPage';
import SlotDiningPage from './pages/SlotDiningPage';
import ProfilePage from './pages/ProfilePage';
import { useStudentSessionGate } from './state/useStudentSessionGate';
import type { ShopSummary, StudentSource } from './types';
import { SHOP_SWITCH_BUSY } from './utils/shopTexts';
import { todayAndTomorrow } from './utils/dates';
import { filterDishesByShop } from './utils/dishShopFilter';
import './student.css';

type StudentView = 'shop' | 'menu' | 'slot' | 'confirm' | 'order' | 'orders' | 'profile';

type DetailFrom = 'menu' | 'orders';

type OrdersBackTo = 'shop' | 'menu';

function previewSlotRequested(): boolean {
  if (new URLSearchParams(window.location.search).get('preview') === 'slot') {
    return true;
  }
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('preview') === 'slot';
}

export default function StudentHome() {
  const { gate } = useStudentSessionGate();
  const sampleMode = resolveStudentMode() === 'sample';
  const previewSlot = sampleMode && previewSlotRequested();

  if (!gate.usable && !sampleMode) {
    return <LoginPage gate={gate} />;
  }

  return <StudentHomeApp previewSlot={previewSlot} />;
}

function StudentHomeApp({ previewSlot }: { previewSlot: boolean }) {
  const [source] = useState<StudentSource>(() => createStudentSource({ mode: resolveStudentMode() }));
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
  const [currentShop, setCurrentShop] = useState<ShopSummary | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [detailFrom, setDetailFrom] = useState<DetailFrom>('menu');
  const [ordersBackTo, setOrdersBackTo] = useState<OrdersBackTo>('shop');
  const [shopNotice, setShopNotice] = useState('');
  const previewStarted = useRef(false);

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

  function goTo(next: StudentView): void {
    setView(next);
    window.scrollTo(0, 0);
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

  if (view === 'profile') {
    return (
      <ProfilePage
        source={source}
        onOpenOrders={() => openOrders('shop')}
        onGoToShop={() => goTo('shop')}
        onGoToMenu={() => {
          if (currentShop) {
            goTo('menu');
          } else {
            source.listShops().then((shops) => {
              if (shops.length > 0) enterShop(shops[0]);
              else goTo('shop');
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
        onGoToHome={() => goTo('shop')}
        onGoToShop={() => goTo('shop')}
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
        onGoToHome={() => goTo('shop')}
        onGoToShop={() => goTo('shop')}
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
      onBackToShops={() => goTo('shop')}
      onProceed={() => goTo('slot')}
      onViewSampleOrder={() => openOrderFrom('menu', 'demo-order-001')}
      onViewCancelOrder={() => openOrderFrom('menu', 'demo-order-cancel-001')}
      onOpenOrders={() => openOrders('menu')}
    />
  );
}