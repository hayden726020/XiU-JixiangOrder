import type { AdminSettings, Order } from '../types';
import { formatDateTime } from '../utils/display';

interface OverviewPageProps {
  orders: Order[];
  settings: AdminSettings;
}

export default function OverviewPage({ orders, settings }: OverviewPageProps) {
  const pendingCancels = orders.filter((order) => order.cancelRequest.status === 'PENDING').length;
  const delayed = orders.filter((order) => order.delay !== null).length;

  return (
    <>
      <div className="admin-stats" aria-label="样例状态摘要">
        <div className="admin-stat">
          <span>样例订单</span>
          <strong>{orders.length}</strong>
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
          <span>核对订单状态、用餐方式与待处理取消申请；首版只读，不提供接单、核销或取消操作。</span>
        </a>
        <a className="admin-link-card" href="#/admin/settings">
          <strong>营业与配置 →</strong>
          <span>查看档口营业时间、食堂范围与两类提醒阈值；当前为演示值，保存功能尚未接入。</span>
        </a>
      </div>

      <div className="admin-section">
        <h3>当前样例口径</h3>
        <ul className="plain-list">
          <li>以 <code>demo-order-001</code> 为三端指认单：堂食、待接单、11:30—12:00、1 份、1800 分、version 1。</li>
          <li>样例中另有 1 笔待处理取消申请和 1 笔已设置延迟，用于异常查询展示。</li>
          <li>配置更新时间为 {formatDateTime(settings.updatedAt)}，版本 {settings.version}。</li>
        </ul>
      </div>

      <p className="hint">
        本页没有调用任何接口；搜索不到取餐码和学生位置。真实订单查询、配置保存分别在 S2、S4 接入，需先确认 DRAFT v0.2 的管理端字段。
      </p>
    </>
  );
}