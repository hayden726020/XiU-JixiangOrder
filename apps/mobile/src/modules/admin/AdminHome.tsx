import { useEffect, useMemo, useState } from 'react';
import {
  getApiBaseInfo,
  getSession,
  logout,
  roleLabel,
  subscribeSession,
  type Session,
} from '../../shared';
import './admin.css';
import './admin-s2.css';
import './admin-s4.css';
import './admin-s6.css';
import './admin-access.css';
import AdminBackLink from './components/AdminBackLink';
import SampleBanner from './components/SampleBanner';

import {
  createAdminSource,
  type AdminErrorSimulation,
  type AdminSourceMode,
} from './data/source';
import OrderDetailPage from './pages/OrderDetailPage';
import OrdersPage from './pages/OrdersPage';
import OverviewPage from './pages/OverviewPage';
import QualificationReviewPage from './pages/QualificationReviewPage';
import MerchantAccountsPage from './pages/MerchantAccountsPage';
import SettingsPage from './pages/SettingsPage';
import type { AdminRoute } from './types';
import './admin-theme.css';

const ADMIN_ROOT = '/admin';

interface AdminLocation {
  route: AdminRoute;
  orderId: string | null;
}

const navItems: Array<{ route: AdminRoute; href: string; label: string }> = [
  { route: 'overview', href: '#/admin', label: '概览' },
  { route: 'orders', href: '#/admin/orders', label: '订单与异常' },
  { route: 'qualifications', href: '#/admin/qualifications', label: '档口审核' },
  { route: 'merchantAccounts', href: '#/admin/merchant-accounts', label: '商家账号' },
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
  if (hash === `${ADMIN_ROOT}/qualifications`) {
    return { route: 'qualifications', orderId: null };
  }
  if (hash === `${ADMIN_ROOT}/merchant-accounts`) {
    return { route: 'merchantAccounts', orderId: null };
  }
  return { route: 'overview', orderId: null };
}

export default function AdminHome() {
  const [location, setLocation] = useState<AdminLocation>(readLocation);
  const [session, setSession] = useState<Session | null>(getSession);
  const [mode, setMode] = useState<AdminSourceMode>(() =>
    getSession()?.user.role === 'ADMIN' ? 'live' : 'sample',
  );
  const [simulateError, setSimulateError] = useState<AdminErrorSimulation>('none');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setLocation(readLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => subscribeSession(() => setSession(getSession())), []);

  const source = useMemo(
    () => createAdminSource({ mode, simulateError: mode === 'sample' ? simulateError : 'none' }),
    [mode, simulateError],
  );
  const isAdmin = session?.user.role === 'ADMIN';
  const isOverview = location.route === 'overview';
  const isOrders = location.route === 'orders';
  const isOrderDetail = location.route === 'orderDetail';
  const isSettings = location.route === 'settings';
  const isQualifications = location.route === 'qualifications';
  const isMerchantAccounts = location.route === 'merchantAccounts';
  const baseInfo = getApiBaseInfo();
  const activeNav = location.route === 'orderDetail' ? 'orders' : location.route;

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch {
      setLogoutError('服务端退出请求失败，本地会话已清除。');
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="module-panel admin-panel admin-panel--access" aria-labelledby="admin-title">
        <div className="admin-access">
          <AdminBackLink to="/" label="返回角色入口" />
          <svg
            className="admin-access__icon"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <rect x="8" y="21" width="32" height="22" rx="5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 21v-6a8 8 0 0 1 16 0v6" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="24" cy="31.5" r="2" fill="currentColor" />
            <path d="M24 33.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <h2 className="admin-access__title" id="admin-title">管理端·需要管理员身份</h2>
          <p className="admin-access__description">
            管理端不向学生或档口展示订单、配置或样例数据，请使用管理员账号登录后进入
          </p>
          <span className="admin-access__session" role="status">
            当前会话：{session ? `${session.user.displayName} · ${roleLabel(session.user.role)}` : '未登录'}
          </span>
          {logoutError ? <p className="admin-access__warn" role="alert">{logoutError}</p> : null}
          <a
            className="admin-access__login"
            href="#/system-check"
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
              }
              event.preventDefault();
              window.history.pushState(null, '', '#/system-check');
              window.dispatchEvent(new Event('hashchange'));
            }}
          >
            去登录管理员 →
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`module-panel admin-panel${isOverview ? ' admin-panel--overview' : ''}${isOrders ? ' admin-panel--orders' : ''}${isOrderDetail ? ' admin-panel--order-detail' : ''}${isSettings ? ' admin-panel--settings' : ''}${isQualifications ? ' admin-panel--qualifications' : ''}${isMerchantAccounts ? ' admin-panel--merchant-accounts' : ''}`}
      aria-labelledby="admin-title"
    >
      {location.route !== 'orderDetail' ? (
        <>
          {mode === 'sample' ? (
            <SampleBanner />
          ) : (
            <div className="admin-banner admin-banner--live" role="status">
              <strong>真实服务 · 订单只读，配置可保存</strong>
              <span>
                数据来自当前公共会话与服务地址；不会回退样例。查询或保存失败时显示失败原因。
              </span>
              <span className="admin-banner__tag">DRAFT v0.3 联调候选</span>
            </div>
          )}

          <h2 id="admin-title">管理端 · 订单与配置</h2>
          <p className="admin-muted">
            S2 提供订单状态筛选、分页、异常标记与只读详情；S3/S5 提供 dining/crowd 只读展示与真实保存；S6/S7 提供 401/403/503 错误态、失败重试与管理员入口收口。
            管理端不改订单状态，也不显示取餐码或学生位置。
          </p>

          <div className="admin-session">
            <span>
              当前会话：
              {session ? `${session.user.displayName} · ${roleLabel(session.user.role)}` : '未登录'}
            </span>
            {mode === 'sample' ? (
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
          </div>

          {mode === 'sample' ? (
            <div className="admin-sim">
              <label>
                <span>错误态演习</span>
                <select
                  value={simulateError}
                  onChange={(event) => setSimulateError(event.target.value as AdminErrorSimulation)}
                >
                  <option value="none">正常样例数据</option>
                  <option value="401">模拟 401 身份失效</option>
                  <option value="403">模拟 403 无管理权限</option>
                  <option value="503">模拟 503 服务不可用</option>
                </select>
              </label>
              <p className="admin-muted">
                仅样例模式模拟，不请求服务端；用于核对 401/403/503 时页面不显示假数据。
              </p>
            </div>
          ) : null}

          {mode === 'live' ? (
            <p className="admin-muted">
              服务地址：{baseInfo.baseUrl ?? '未配置'}。真机需在公共自检页配置手机可访问的地址，不能使用 localhost。
            </p>
          ) : null}
        </>
      ) : null}

      {location.route !== 'orderDetail' ? (
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
      ) : null}

      {location.route === 'orderDetail' && location.orderId ? (
        <OrderDetailPage source={source} orderId={location.orderId} />
      ) : location.route === 'orders' ? (
        <OrdersPage
          source={source}
          errorSimulation={simulateError}
          onErrorSimulationChange={setSimulateError}
          onShowSample={(simulation = 'none') => {
            setSimulateError(simulation);
            setMode('sample');
          }}
        />
      ) : location.route === 'settings' ? (
        <SettingsPage source={source} />
      ) : location.route === 'qualifications' ? (
        <QualificationReviewPage source={source} />
      ) : location.route === 'merchantAccounts' ? (
        <MerchantAccountsPage source={source} />
      ) : (
        <OverviewPage
          mode={mode}
          session={session}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
        />
      )}
    </section>
  );
}