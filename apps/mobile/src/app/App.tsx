import { useEffect, useState } from 'react';
import { mobileModules } from './moduleRegistry';
import SystemCheck from './SystemCheck';

const HOME_ROUTE = '/';
const CHECK_ROUTE = '/system-check';

function readRoute(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const normalized = hash.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : HOME_ROUTE;
}

function navigate(route: string): void {
  window.location.hash = route;
}

function Home() {
  return (
    <section className="home-panel" aria-labelledby="home-title">
      <h2 id="home-title">角色入口预览</h2>
      <p className="lead">
        三个角色最终共用一个安装包。当前已接通公共入口、学生模块和管理员样例模块，不含登录、真实订单或后端；这里点击入口只用于预览，不构成角色授权。
      </p>
      <div className="module-grid">
        {mobileModules.map((module) => (
          <button
            key={module.id}
            type="button"
            className="module-card"
            onClick={() => navigate(module.route)}
          >
            <span className="module-card__title">{module.title}</span>
            <span className="module-card__desc">{module.subtitle}</span>
            <span className={`status status--${module.status}`}>
              {module.status === 'ready' ? '入口已接通' : '待接入'}
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="check-entry" onClick={() => navigate(CHECK_ROUTE)}>
        公共能力自检（服务、登录与定位）
      </button>
    </section>
  );
}

function NotFound() {
  return (
    <section className="module-panel" aria-labelledby="not-found-title">
      <h2 id="not-found-title">未找到该入口</h2>
      <p className="lead">当前地址没有对应的角色模块，请返回角色入口重新选择。</p>
      <button type="button" className="back-link" onClick={() => navigate(HOME_ROUTE)}>
        ← 返回角色入口
      </button>
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const activeModule = mobileModules.find(
    (module) => route === module.route || route.startsWith(`${module.route}/`),
  );
  const ActiveComponent = activeModule?.Component;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">单 APK · 三角色共用</p>
          <h1>吉祥点餐</h1>
        </div>
        <span className="app-version">S1 样例</span>
      </header>

      <main className="app-main">
        {route === CHECK_ROUTE ? (
          <>
            <button type="button" className="back-link" onClick={() => navigate(HOME_ROUTE)}>
              ← 返回角色入口
            </button>
            <SystemCheck />
          </>
        ) : ActiveComponent ? (
          <>
            <button type="button" className="back-link" onClick={() => navigate(HOME_ROUTE)}>
              ← 返回角色入口
            </button>
            <ActiveComponent />
          </>
        ) : route === HOME_ROUTE ? (
          <Home />
        ) : (
          <NotFound />
        )}
      </main>

      <footer className="app-footer">
        <p>当前为 S1 样例骨架：学生与管理员模块已接入，页面为样例，业务接口与服务端尚未实现。</p>
        <p>公共层已封装登录、请求与一次性定位；服务地址未配置时明确失败，不回落样例成功。S1 页面尚未在真机复验。</p>
      </footer>
    </div>
  );
}