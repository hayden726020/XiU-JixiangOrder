import { useEffect, useState } from 'react';
import './admin.css';
import SampleBanner from './components/SampleBanner';
import { createAdminSource } from './data/source';
import OverviewPage from './pages/OverviewPage';
import OrdersPage from './pages/OrdersPage';
import SettingsPage from './pages/SettingsPage';
import type { AdminRoute } from './types';

const ADMIN_ROOT = '/admin';
const source = createAdminSource({ mode: 'sample' });

const navItems: Array<{ route: AdminRoute; href: string; label: string }> = [
  { route: 'overview', href: '#/admin', label: '概览' },
  { route: 'orders', href: '#/admin/orders', label: '订单与异常' },
  { route: 'settings', href: '#/admin/settings', label: '营业与配置' },
];

function readRoute(): AdminRoute {
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  if (hash === `${ADMIN_ROOT}/orders`) {
    return 'orders';
  }
  if (hash === `${ADMIN_ROOT}/settings`) {
    return 'settings';
  }
  return 'overview';
}

export default function AdminHome() {
  const [route, setRoute] = useState<AdminRoute>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const orders = source.listOrders();
  const settings = source.getSettings();

  return (
    <section className="module-panel admin-panel" aria-labelledby="admin-title">
      <SampleBanner />
      <h2 id="admin-title">管理端 · 样例骨架</h2>
      <p className="admin-muted">
        管理端用于核对档口营业时间和订单异常、维护食堂范围与提醒条件。当前页面只读，未接入登录、权限和真实服务；进入本页不代表已获得管理权限。
      </p>

      <nav className="admin-nav" aria-label="管理端页面">
        {navItems.map((item) => (
          <a
            key={item.route}
            href={item.href}
            aria-current={route === item.route ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {route === 'orders' ? (
        <OrdersPage orders={orders} />
      ) : route === 'settings' ? (
        <SettingsPage settings={settings} />
      ) : (
        <OverviewPage orders={orders} settings={settings} />
      )}
    </section>
  );
}