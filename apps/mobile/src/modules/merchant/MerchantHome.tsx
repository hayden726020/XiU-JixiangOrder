import { useMemo, useState } from 'react';
import SampleBanner from './components/SampleBanner';
import { SAMPLE_DATES } from './data/sampleData';
import { createMerchantSource } from './data/source';
import type { MerchantScenario } from './data/types';
import MenuPage from './pages/MenuPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderListPage from './pages/OrderListPage';
import { actionPrompt, type OrderAction } from './state/actionMatrix';
import { resolveMenuDate, todayIso } from './state/menuView';
import './merchant.css';

type View =
  | { name: 'list' }
  | { name: 'detail'; orderId: string }
  | { name: 'menu' };

export default function MerchantHome() {
  const [scenario, setScenario] = useState<MerchantScenario>('normal');
  const [view, setView] = useState<View>({ name: 'list' });
  const today = useMemo(() => todayIso(), []);
  const [menuDate, setMenuDate] = useState<string>(() => resolveMenuDate(SAMPLE_DATES, today));
  const [notice, setNotice] = useState<string | null>(null);

  const source = useMemo(() => createMerchantSource({ mode: 'sample', scenario }), [scenario]);
  const ordersResult = source.getOrders();
  const orders = ordersResult.ok ? ordersResult.data : [];
  const menuResult = source.getMenu(menuDate);
  const slotsResult = source.getSlots(menuDate);
  const menu = menuResult.ok ? menuResult.data : null;
  const slots = slotsResult.ok ? slotsResult.data : null;

  const activeOrder = view.name === 'detail'
    ? orders.find((order) => order.id === view.orderId) ?? null
    : null;

  function changeScenario(next: MerchantScenario) {
    setScenario(next);
    setView({ name: 'list' });
    setNotice(null);
  }

  function openOrder(id: string) {
    setView({ name: 'detail', orderId: id });
    setNotice(null);
  }

  function handleAction(orderId: string, action: OrderAction) {
    setNotice(actionPrompt(action, orderId));
  }

  return (
    <section className="module-panel merchant-panel">
      <SampleBanner />

      {notice && (
        <div className="merchant-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="merchant-notice__close"
            onClick={() => setNotice(null)}
          >
            关闭
          </button>
        </div>
      )}

      {!ordersResult.ok && (
        <p className="merchant-empty">样例数据读取失败：{ordersResult.error.message}</p>
      )}

      {view.name === 'list' && (
        <OrderListPage
          orders={orders}
          scenario={scenario}
          onScenarioChange={changeScenario}
          onOpenOrder={openOrder}
          onOpenMenu={() => setView({ name: 'menu' })}
        />
      )}

      {view.name === 'detail' && (
        activeOrder ? (
          <OrderDetailPage
            order={activeOrder}
            onBack={() => setView({ name: 'list' })}
            onAction={(action) => handleAction(activeOrder.id, action)}
          />
        ) : (
          <p className="merchant-empty">订单不存在或已不在当前样例场景中。</p>
        )
      )}

      {view.name === 'menu' && (
        <MenuPage
          dates={SAMPLE_DATES}
          date={menuDate}
          today={today}
          onDateChange={setMenuDate}
          menu={menu}
          slots={slots}
          onBack={() => setView({ name: 'list' })}
        />
      )}
    </section>
  );
}