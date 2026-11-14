import { useState } from 'react';
import { createStudentSource } from './data/sampleSource';
import { resolveStudentMode } from './data/mode';
import { createOrderDraft } from './state/orderDraft';
import {
  clearDraftSnapshot,
  readDraftSnapshot,
  saveDraftSnapshot,
} from './state/draftSnapshot';
import ConfirmPage from './pages/ConfirmPage';
import MenuPage from './pages/MenuPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderListPage from './pages/OrderListPage';
import SlotDiningPage from './pages/SlotDiningPage';
import type { StudentSource } from './types';
import { todayAndTomorrow } from './utils/dates';
import './student.css';

type StudentView = 'menu' | 'slot' | 'confirm' | 'order' | 'orders';

type DetailFrom = 'menu' | 'orders';

export default function StudentHome() {
  const [source] = useState<StudentSource>(() => createStudentSource({ mode: resolveStudentMode() }));
  const [draft] = useState(() => {
    if (source.mode === 'real') {
      const dates = todayAndTomorrow(new Date());
      const restored = readDraftSnapshot({ allowedDates: dates });
      const realDraft = createOrderDraft({
        source,
        allowedDates: dates,
        initialDate: restored?.date ?? dates[0],
        onChange: (snapshot) => {
          if (snapshot.status === 'success' || snapshot.totalQuantity === 0) {
            clearDraftSnapshot();
            return;
          }
          saveDraftSnapshot({
            date: snapshot.date,
            items: snapshot.items,
            slotId: snapshot.slotId,
            diningMode: snapshot.diningMode,
          });
        },
      });
      if (restored) {
        realDraft.restoreSelection(restored);
      }
      return realDraft;
    }
    return createOrderDraft({ source });
  });
  const [view, setView] = useState<StudentView>('menu');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [detailFrom, setDetailFrom] = useState<DetailFrom>('menu');

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

  if (view === 'slot') {
    return (
      <SlotDiningPage
        source={source}
        draft={draft}
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
        onBack={() => goTo('slot')}
        onBackToMenu={() => goTo('menu')}
        onSubmitted={(id) => openOrderFrom('menu', id)}
      />
    );
  }

  if (view === 'orders') {
    return (
      <OrderListPage
        source={source}
        onBack={() => goTo('menu')}
        onOpenOrder={(id) => openOrderFrom('orders', id)}
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
      />
    );
  }

  return (
    <MenuPage
      source={source}
      draft={draft}
      onProceed={() => goTo('slot')}
      onViewSampleOrder={() => openOrderFrom('menu', 'demo-order-001')}
      onOpenOrders={() => goTo('orders')}
    />
  );
}