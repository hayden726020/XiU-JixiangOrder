import { useState } from 'react';
import ActionBar from '../components/ActionBar';
import type { MerchantOrder } from '../data/types';
import {
  getOrderActions,
  getPrimaryAction,
  type ActionInput,
  type OrderAction,
} from '../state/actionMatrix';
import {
  cancelRequestLabel,
  diningModeView,
  formatDateTime,
  formatSlot,
  paymentText,
  STATUS_TRACK,
  statusView,
} from '../state/orderView';
import { fenToYuan, formatYuan, totalQuantity } from '../utils/money';

interface NewOrderDetailPageProps {
  order: MerchantOrder;
  mode: 'sample' | 'real';
  onBack: () => void;
  onAction: (action: OrderAction, input?: ActionInput) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  pendingCode?: string | null;
  actionError?: { code: string; message: string } | null;
}

export default function NewOrderDetailPage({
order,
  mode,
  onBack,
  onAction,
  onRefresh,
  refreshing = false,
  pendingCode = null,
  actionError = null,
}: NewOrderDetailPageProps) {
  const [cancelReason, setCancelReason] = useState('');
  const [stockCancelReason, setStockCancelReason] = useState('');
  const [showStockCancelForm, setShowStockCancelForm] = useState(false);


  const actions = getOrderActions(order);
  const primary = getPrimaryAction(order);
  const approveAction = actions.find((action) => action.code === 'APPROVE_CANCEL');
  const rejectAction = actions.find((action) => action.code === 'REJECT_CANCEL');
  const stockCancelAction = actions.find((action) => action.code === 'CANCEL_ORDER');

  const mainActions = actions.filter(
    (action) => action.kind === 'primary' && action.code !== 'VERIFY' && action.code !== 'CANCEL_ORDER',
  );
  const busy = (action: OrderAction | undefined) => Boolean(action) && pendingCode === action?.code;
  const busyLabel = (action: OrderAction | undefined) => (busy(action) ? '提交中…' : action?.label);
  const errorFor = (code: string) => (actionError?.code === code ? actionError.message : null);
  const cancelError = errorFor('APPROVE_CANCEL') ?? errorFor('REJECT_CANCEL');
  const otherError = actionError
    && !['APPROVE_CANCEL', 'REJECT_CANCEL', 'CANCEL_ORDER'].includes(actionError.code)
    ? actionError.message
    : null;
  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const currentIndex = STATUS_TRACK.indexOf(order.status);

  return (
    <div
      className="merchant-view merchant-order-detail merchant-order-detail--new"
      data-order-id={order.id}
      data-order-status={order.status}
    >
      <div className="merchant-order-detail__topbar">
        <button type="button" className="back-link merchant-order-detail__back" onClick={onBack}>
          ← 返回订单列表
        </button>
        {mode === 'real' && (
          <button
            type="button"
            className="merchant-link-button merchant-order-detail__refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
            title="真实模式下会定时自动刷新"
            data-refresh-order
          >
            {refreshing ? '刷新中…' : '刷新订单'}
          </button>
        )}
      </div>

      <header className="detail-header">
        <p className="badge">
          {order.demo || mode === 'sample' ? '样例订单 · demo=true' : '真实数据 · 演示服务'}
        </p>
        <div className="detail-id">
          <h2 className="detail-id__short">{order.id}</h2>
        </div>
        <div className="detail-tags">
          <span className={`merchant-tag merchant-tag--${status.tone}`}>{status.label}</span>
          <span className={`merchant-tag merchant-tag--${dining.tone}`}>{dining.label}</span>
        </div>
        {order.cancelRequest.status === 'PENDING' && (
          <p className="detail-alert">学生申请取消，请优先处理；申请不等于已取消。</p>
        )}
        <p className="detail-next">下一步：{primary ? primary.label : '当前没有可用的主操作'}</p>
      </header>

      <section className="detail-block detail-block--appointment">
        <h3>预约时间</h3>
        <p className="detail-emphasis">{formatSlot(order)}</p>
        <p className="hint">档口应在这个时段内做好，到点不一定已好。</p>
      </section>

      <section className="detail-block detail-block--items">
        <h3>菜品与金额</h3>
        <ul className="detail-items">
          {order.items.map((item) => (
            <li key={item.dishId}>
              <span>{item.name} ×{item.quantity}</span>
              <span>{fenToYuan(item.unitPriceFen)} 元/份</span>
            </li>
          ))}
        </ul>
        <p className="detail-total">
          <span>总份数 <strong>{totalQuantity(order.items)}</strong> 份 · 合计</span>
          <strong className="detail-total__amount">合计 {formatYuan(order.totalFen)}</strong>
        </p>
      </section>

      <section className="detail-block detail-block--status">
        <h3>状态轴</h3>
        <ol className="status-track">
          {STATUS_TRACK.map((step, index) => (
            <li
              key={step}
              aria-current={index === currentIndex ? 'step' : undefined}
              className={index <= currentIndex ? 'status-track__step status-track__step--on' : 'status-track__step'}
            >
              {statusView(step).label}
            </li>
          ))}
        </ol>
      </section>

      <section className="detail-block detail-block--meta">
        <div className="detail-info-row">
          <h3>时间</h3>
          <ul className="detail-times">
            <li>创建：{formatDateTime(order.createdAt)}</li>
            <li>更新：{formatDateTime(order.updatedAt)}</li>
            <li>取餐：{order.pickedUpAt ? formatDateTime(order.pickedUpAt) : '尚未取餐'}</li>
          </ul>
        </div>

        <div className="detail-info-row">
          <h3>支付</h3>
          <div className="detail-info-row__content">
            <p className="merchant-muted" data-payment-status={order.paymentStatus}>
              {paymentText(order.paymentStatus)}
            </p>
          </div>
        </div>

        <div className="detail-info-row">
          <h3>取消申请</h3>
          <div className="detail-info-row__content">
            <p className="merchant-muted">{cancelRequestLabel(order.cancelRequest)}</p>
            {order.cancelRequest.reason && (
              <p className="merchant-muted">申请理由：{order.cancelRequest.reason}</p>
            )}
            {order.cancelRequest.decisionReason && (
              <p className="merchant-muted">处理理由：{order.cancelRequest.decisionReason}</p>
            )}
            {approveAction && rejectAction && (
              <div className="merchant-order-detail__form">
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="批准或拒绝都必须填写理由"
                  rows={2}
                  aria-label="取消申请处理理由"
                />
                <div className="action-bar">
                  <button
                    type="button"
                    className="action-button action-button--danger"
                    onClick={() => onAction(approveAction, { reason: cancelReason })}
                    disabled={busy(approveAction)}
                    aria-busy={busy(approveAction) || undefined}
                  >
                    {busyLabel(approveAction)}
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => onAction(rejectAction, { reason: cancelReason })}
                    disabled={busy(rejectAction)}
                    aria-busy={busy(rejectAction) || undefined}
                  >
                    {busyLabel(rejectAction)}
                  </button>
                </div>
                {cancelError && (
                  <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
                    {cancelError}
                  </p>
                )}
                <p className="hint">批准会取消订单并模拟退款；申请不等于已取消。</p>
              </div>
            )}
          </div>
        </div>

        <div className="detail-info-row">
          <h3>延迟</h3>
          <div className="detail-info-row__content">
            <p className="merchant-muted">
              {order.delay
                ? `${order.delay.reason} · 预计 ${formatDateTime(order.delay.expectedReadyAt)} 可取`
                : '未设置延迟'}
            </p>
          </div>
        </div>
      </section>

      <section className="detail-block detail-block--dining">
        <h3>用餐方式</h3>
        <p className="detail-emphasis">{dining.label} · {dining.description}</p>
        {order.diningModeReason && <p className="merchant-muted">变更理由：{order.diningModeReason}</p>}
        <p className="hint">用餐方式由学生下单时选择，档口不可修改。</p>
      </section>

      <section className="detail-block detail-block--operations">
        <h3>操作</h3>
        <div className="merchant-order-detail__action-grid">
          <ActionBar
            actions={mainActions}
            onAction={onAction}
            emptyText="当前没有可用的主操作"
            mode={mode}
            pendingCode={pendingCode}
            errorText={otherError}
          />
          {stockCancelAction && (
            <button
              type="button"
              className="action-button action-button--danger"
              onClick={() => setShowStockCancelForm((current) => !current)}
              disabled={busy(stockCancelAction)}
              aria-expanded={showStockCancelForm}
              aria-controls="new-order-stock-cancel-form"
            >
              {showStockCancelForm ? '收起缺货取消' : stockCancelAction.label}
            </button>
          )}
        </div>
        {stockCancelAction && showStockCancelForm && (
          <div className="merchant-order-detail__form" id="new-order-stock-cancel-form">
            <textarea
              value={stockCancelReason}
              onChange={(event) => setStockCancelReason(event.target.value)}
              placeholder="填写缺货原因"
              rows={2}
              aria-label="缺货取消原因"
            />
            <button
              type="button"
              className="action-button action-button--danger"
              onClick={() => onAction(stockCancelAction, { reason: stockCancelReason })}
              disabled={busy(stockCancelAction)}
              aria-busy={busy(stockCancelAction) || undefined}
            >
              {busy(stockCancelAction) ? '提交中…' : '确认缺货取消'}
            </button>
            <p className="hint">
              仅未结束订单可取消；取消后模拟退款，并返还菜品库存与尚未开始时段的 1 个名额。
            </p>
          </div>
        )}
        {errorFor('CANCEL_ORDER') && (
          <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
            {errorFor('CANCEL_ORDER')}
          </p>
        )}
      </section>
    </div>
  );
}