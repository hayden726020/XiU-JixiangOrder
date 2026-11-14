import { useState } from 'react';
import { createDefaultStudentSource } from './data/sampleSource';
import { createOrderDraft } from './state/orderDraft';
import ConfirmPage from './pages/ConfirmPage';
import MenuPage from './pages/MenuPage';
import OrderDetailPage from './pages/OrderDetailPage';
import SlotDiningPage from './pages/SlotDiningPage';
import type { StudentSource } from './types';
import './student.css';

type StudentView = 'menu' | 'slot' | 'confirm' | 'order';

export default function StudentHome() {
  const [source] = useState<StudentSource>(() => createDefaultStudentSource());
  const [draft] = useState(() => createOrderDraft({ source }));
  const [view, setView] = useState<StudentView>('menu');
  const [orderId, setOrderId] = useState<string | null>(null);

  function goTo(next: StudentView): void {
    setView(next);
    window.scrollTo(0, 0);
  }

  function openOrder(id: string): void {
    setOrderId(id);
    goTo('order');
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
        onSubmitted={openOrder}
      />
    );
  }

  if (view === 'order' && orderId !== null) {
    return <OrderDetailPage source={source} orderId={orderId} onBack={() => goTo('menu')} />;
  }

  return (
    <MenuPage
      source={source}
      draft={draft}
      onProceed={() => goTo('slot')}
      onViewSampleOrder={() => openOrder('demo-order-001')}
    />
  );
}