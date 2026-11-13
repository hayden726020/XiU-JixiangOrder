import { useEffect, useMemo, useState } from 'react';
import {
  getApiBaseInfo,
  getSession,
  roleLabel,
  subscribeSession,
  type Session,
} from '../../shared';
import './admin.css';
import './admin-s2.css';
import './admin-s4.css';
import SampleBanner from './components/SampleBanner';

import { createAdminSource, type AdminSourceMode } from './data/source';
import OrderDetailPage from './pages/OrderDetailPage';
import OrdersPage from './pages/OrdersPage';
import OverviewPage from './pages/OverviewPage';
import SettingsPage from './pages/SettingsPage';
import type { AdminRoute } from './types';

const ADMIN_ROOT = '/admin';

interface AdminLocation {
  route: AdminRoute;
  orderId: string | null;
}

const navItems: Array<{ route: AdminRoute; href: string; label: string }> = [
  { route: 'overview', href: '#/admin', label: '概览' },
  { route: 'orders', href: '#/admin/orders', label: '订单与异常' },
  { route: 'settings', href: '#/admin/settings', label: '营业与配置' },
];

function readLocation(): AdminLocation {
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  if (hash.startsWith(`${ADMIN_ROOT}/orders/`)) {
    const raw = hash.slice(`${ADMIN_ROOT}/orders/`.length);
    if (raw.length > 0) {
      try {
        return { route: 'orderDetail', orderId: decodeURIComponent(raw) };
      } catch {
        return { route: 'orders', orderId: null };
      }
    }
  }
  if (hash === `${ADMIN_ROOT}/orders`) {
    return { route: 'orders', orderId: null };
  }
  if (hash === `${ADMIN_ROOT}/settings`) {
    return { route: 'settings', orderId: null };
  }
  return { route: 'overview', orderId: null };
}

export default function AdminHome() {
  const [location, setLocation] = useState<AdminLocation>(readLocation);
  const [session, setSession] = useState<Session | null>(getSession);
  const [mode, setMode] = useState<AdminSourceMode>(() =>
    getSession()?.user.role === 'ADMIN' ? 'live' : 'sample',
  );

  useEffect(() => {
    const onHashChange = () => setLocation(readLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => subscribeSession(() => setSession(getSession())), []);

  const source = useMemo(() => createAdminSource({ mode }), [mode]);
  const isAdmin = session?.user.role === 'ADMIN';
  const baseInfo = getApiBaseInfo();
  const activeNav = location.route === 'orderDetail' ? 'orders' : location.route;

  return (
    <section className="module-panel admin-panel" aria-labelledby="admin-title">
      {mode === 'sample' ? (
        <SampleBanner />
      ) : (
        <div className="admin-banner admin-banner--live" role="status">
          <strong>真实服务 · 只读</strong>
          <span>
            数据来自当前公共会话与服务地址；不会回退样例。查询失败时显示失败原因。
          </span>
          <span className="admin-banner__tag">DRAFT v0.3 联调候选</span>
        </div>
      )}

      <h2 id="admin-title">管理端 · 订单与配置</h2>
      <p className="admin-muted">
        S2 提供订单状态筛选、分页、异常标记与只读详情；S3/S5 提供 dining/crowd 只读展示与真实保存，保存后重新读取确认。
        管理端不改订单状态，也不显示取餐码或学生位置。
      </p>

      <div className="admin-session">
        <span>
          当前会话：
          {session ? `${session.user.displayName} · ${roleLabel(session.user.role)}` : '未登录'}
        </span>
        {mode === 'sample' && isAdmin ? (
          <button type="button" className="admin-action" onClick={() => setMode('live')}>
            连接真实服务
          </button>
        ) : null}
        {mode === 'live' ? (
          <button type="button" className="admin-action" onClick={() => setMode('sample')}>
            查看样例数据
          </button>
        ) : null}
        {!session ? <a href="#/system-check">去公共自检页登录 →</a> : null}
        {session && !isAdmin ? (
          <span className="admin-warn">当前账号不是管理员，真实查询会返回 403。</span>
        ) : null}
      </div>

      {mode === 'live' ? (
        <p className="admin-muted">
          服务地址：{baseInfo.baseUrl ?? '未配置'}。真机需在公共自检页配置手机可访问的地址，不能使用 localhost。
        </p>
      ) : null}

      <nav className="admin-nav" aria-label="管理端页面">
        {navItems.map((item) => (
          <a
            key={item.route}
            href={item.href}
            aria-current={activeNav === item.route ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {location.route === 'orderDetail' && location.orderId ? (
        <OrderDetailPage source={source} orderId={location.orderId} />
      ) : location.route === 'orders' ? (
        <OrdersPage source={source} />
      ) : location.route === 'settings' ? (
        <SettingsPage source={source} />
      ) : (
        <OverviewPage mode={mode} session={session} />
      )}
    </section>
  );
}