import { roleLabel, type Session } from '../../../shared';
import '../admin-overview.css';
import { sampleOrders } from '../data/sample';
import type { AdminSourceMode } from '../data/source';

interface OverviewPageProps {
  mode: AdminSourceMode;
  session: Session | null;
  isLoggingOut: boolean;
  onLogout: () => Promise<void>;
}

export default function OverviewPage({
  mode,
  session,
  isLoggingOut,
  onLogout,
}: OverviewPageProps) {
  const pendingCancels = sampleOrders.filter((order) => order.cancelRequest.status === 'PENDING').length;
  const delayed = sampleOrders.filter((order) => order.delay !== null).length;

  return (
    <div className="admin-overview">
      <header className="admin-overview__header">
        <p>管理端</p>
        <h2 className="admin-overview__title" id="admin-title">概览</h2>
      </header>

      {mode === 'sample' ? (
        <div className="admin-overview__stats" aria-label="样例状态摘要">
          <div className="admin-overview__stat">
            <span>样例订单</span>
            <strong>{sampleOrders.length}</strong>
          </div>
          <div className="admin-overview__stat">
            <span>待处理取消</span>
            <strong>{pendingCancels}</strong>
          </div>
          <div className="admin-overview__stat">
            <span>已设延迟</span>
            <strong>{delayed}</strong>
          </div>
        </div>
      ) : (
        <div className="admin-overview__notice" role="status">
          <strong>真实服务</strong>
          <p>请进入“订单与异常查询”读取服务端数据，概览不会使用样例数据代替。</p>
        </div>
      )}

      <nav className="admin-overview__links" aria-label="管理功能">
        <a className="admin-overview__link" href="#/admin/orders">
          <span className="admin-overview__link-body">
            <strong>订单与异常查询</strong>
            <span>按状态筛选、分页、查看异常标记与只读详情</span>
          </span>
          <span className="admin-overview__arrow" aria-hidden="true">→</span>
        </a>
        <a className="admin-overview__link" href="#/admin/settings">
          <span className="admin-overview__link-body">
            <strong>营业与配置</strong>
            <span>查看食堂范围与提醒阈值，可分别编辑保存</span>
          </span>
          <span className="admin-overview__arrow" aria-hidden="true">→</span>
        </a>
      </nav>

      <section className="admin-overview__session" aria-label="当前会话">
        <p>
          当前会话：
          <strong>
            {session ? `${session.user.displayName} · ${roleLabel(session.user.role)}` : '未登录'}
          </strong>
        </p>
        <button
          type="button"
          disabled={isLoggingOut || !session}
          onClick={() => void onLogout()}
        >
          {isLoggingOut ? '退出中…' : '退出'}
        </button>
      </section>
    </div>
  );
}