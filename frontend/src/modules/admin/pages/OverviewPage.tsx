import { roleLabel, type Session } from '../../../shared';
import { sampleOrders, sampleSettings } from '../data/sample';
import type { AdminSourceMode } from '../data/source';
import { formatDateTime } from '../utils/display';

interface OverviewPageProps {
  mode: AdminSourceMode;
  session: Session | null;
}

export default function OverviewPage({ mode, session }: OverviewPageProps) {
  const pendingCancels = sampleOrders.filter((order) => order.cancelRequest.status === 'PENDING').length;
  const delayed = sampleOrders.filter((order) => order.delay !== null).length;

  return (
    <>
      {mode === 'sample' ? (
        <>
          <div className="admin-stats" aria-label="样例状态摘要">
            <div className="admin-stat">
              <span>样例订单</span>
              <strong>{sampleOrders.length}</strong>
            </div>
            <div className="admin-stat">
              <span>待处理取消</span>
              <strong>{pendingCancels}</strong>
            </div>
            <div className="admin-stat">
              <span>已设延迟</span>
              <strong>{delayed}</strong>
            </div>
          </div>

          <div className="admin-card-grid">
            <a className="admin-link-card" href="#/admin/orders">
              <strong>订单与异常查询 →</strong>
              <span>按状态筛选、分页、标记待处理取消与延迟，进入只读详情；不提供接单、核销或取消操作。</span>
            </a>
            <a className="admin-link-card" href="#/admin/settings">
              <strong>营业与配置 →</strong>
              <span>查看食堂范围 dining 与提醒阈值 crowd；S5 支持分别保存并处理版本冲突；S6 提供 401/403/503 错误态；档口营业时间暂无端点。</span>
            </a>
          </div>

          <div className="admin-section">
            <h3>当前样例口径</h3>
            <ul className="plain-list">
              <li>
                以 <code>demo-order-001</code> 为三端指认单：堂食、待接单、11:30—12:00、1 份、1800 分、version 1。
              </li>
              <li>样例中另有 1 笔待处理取消申请和 1 笔已设置延迟，用于异常查询展示。</li>
              <li>S6 错误演习可切到模拟 401/403/503；错误态不显示样例或服务端数据，也不提供切换管理员按钮。</li>
              <li>
                配置以服务端 dining/crowd 两段为准：半径 {sampleSettings.dining.radiusMeters} 米、误差容忍{' '}
                {sampleSettings.dining.accuracyToleranceMeters} 米、当前参考阈值 {sampleSettings.crowd.crowdedAt} 人，
                版本 dining {sampleSettings.dining.version} / crowd {sampleSettings.crowd.version}。
              </li>
            </ul>
          </div>
        </>
      ) : (
        <div className="notice">
          <strong>真实模式</strong>
          <p>概览不展示样例统计；请进入“订单与异常”读取服务端分页数据。</p>
        </div>
      )}

      <div className="admin-section">
        <h3>当前会话</h3>
        <p className="admin-muted">
          {session
            ? `${session.user.displayName} · ${roleLabel(session.user.role)} · 会话到期 ${formatDateTime(session.expiresAt)}`
            : '未登录。真实查询需要管理员账号，可先到公共能力自检页登录。'}
        </p>
      </div>

      <p className="hint">
        管理端最小范围：订单与异常查询、档口营业时间、食堂范围与提醒条件。页面不显示取餐码、学生位置，不修改订单状态。
        真实订单接口当前只支持状态筛选与分页；异常筛选仅作用于当前页。
      </p>
    </>
  );
}