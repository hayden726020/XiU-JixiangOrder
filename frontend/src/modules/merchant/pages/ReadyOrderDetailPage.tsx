import { useState } from 'react';
import type { MerchantOrder } from '../data/types';
import {
  getOrderActions,
  getPrimaryAction,
  type ActionInput,
  type OrderAction,
} from '../state/actionMatrix';
import {
  cancelRequestLabel,
  diningModeChangeLabel,
  diningModeChangeRoute,
  diningModeView,
  formatDateTime,
  formatSlot,
  orderNoLabel,
  paymentText,
  STATUS_TRACK,
  statusView,
} from '../state/orderView';
import { orderPackagingFeeFen } from '../state/packagingFee';
import { fenToYuan, formatYuan, totalQuantity } from '../utils/money';

interface ReadyOrderDetailPageProps {
  order: MerchantOrder;
  mode: 'sample' | 'real';
  onBack: () => void;
  onAction: (action: OrderAction, input?: ActionInput) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  pendingCode?: string | null;
  actionError?: { code: string; message: string } | null;
}

type CancelDecision = 'APPROVE_CANCEL' | 'REJECT_CANCEL';

export default function ReadyOrderDetailPage({
order,
  mode,
  onBack,
  onAction,
  onRefresh,
  refreshing = false,
  pendingCode = null,
  actionError = null,
}: ReadyOrderDetailPageProps) {
  const [pickupCode, setPickupCode] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDecision, setCancelDecision] = useState<CancelDecision | null>(null);
  const [stockCancelReason, setStockCancelReason] = useState('');
  const [showStockCancelForm, setShowStockCancelForm] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [delayExpectedReadyAt, setDelayExpectedReadyAt] = useState('');
  const [showDelayForm, setShowDelayForm] = useState(false);


  const packagingFeeFen = orderPackagingFeeFen(order);
  const actions = getOrderActions(order);
  const primary = getPrimaryAction(order);
  const verifyAction = actions.find((action) => action.code === 'VERIFY');
  const approveAction = actions.find((action) => action.code === 'APPROVE_CANCEL');
  const rejectAction = actions.find((action) => action.code === 'REJECT_CANCEL');
  const stockCancelAction = actions.find((action) => action.code === 'CANCEL_ORDER');
  const delayAction = actions.find((action) => action.code === 'SET_DELAY');

  const cancelDecisionAction = cancelDecision === 'APPROVE_CANCEL'
    ? approveAction
    : cancelDecision === 'REJECT_CANCEL' ? rejectAction : undefined;
  const busy = (action: OrderAction | undefined) => Boolean(action) && pendingCode === action?.code;
  const busyLabel = (action: OrderAction | undefined) => (busy(action) ? '提交中…' : action?.label);
  const errorFor = (code: string) => (actionError?.code === code ? actionError.message : null);
  const cancelError = errorFor('APPROVE_CANCEL') ?? errorFor('REJECT_CANCEL');
  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const currentIndex = STATUS_TRACK.indexOf(order.status);

  return (
    <div
      className="merchant-view merchant-order-detail merchant-order-detail--new merchant-order-detail--ready"
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
          <h2 className="detail-id__short">{orderNoLabel(order)}</h2>
        </div>
        <div className="detail-tags">
          <span className={`merchant-tag merchant-tag--${status.tone}`}>{status.label}</span>
          <span className={`merchant-tag merchant-tag--${dining.tone}`}>{dining.label}</span>
        </div>
        {order.diningModeChange.status === 'PENDING' && (
          <p className="detail-alert" data-dining-mode-change="PENDING">
            学生申请更改用餐方式：{diningModeChangeRoute(order.diningModeChange)}，取餐前请先确认。
          </p>
        )}
        <p className="detail-next">下一步：{primary ? primary.label : '当前没有可用的主操作'}</p>
      </header>

      <section className="detail-block detail-block--appointment">
        <h3>预约时间</h3>
        <p className="detail-emphasis">{formatSlot(order)}</p>
        <p className="hint">档口应在这个时段内做好，到点不一定已好。</p>
      </section>

      <section className="detail-block detail-block--remark">
        <h3>订单备注</h3>
        {order.remark ? (
          <p className="detail-remark" data-order-remark={order.remark}>{order.remark}</p>
        ) : (
          <p className="merchant-muted detail-remark detail-remark--empty">学生未填写备注</p>
        )}
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
          {packagingFeeFen !== null && (
            <li className="detail-items__fee" data-order-packaging-fee={packagingFeeFen}>
              <span>打包盒 ×1（外带）</span>
              <span>{formatYuan(packagingFeeFen)}</span>
            </li>
          )}
        </ul>
        <p className="detail-total">
          <span>总份数 <strong>{totalQuantity(order.items)}</strong> 份</span>
          <strong className="detail-total__amount">合计 {formatYuan(order.totalFen)}</strong>
        </p>
        {packagingFeeFen !== null && (
          <p className="hint detail-packaging-note" data-order-packaging-note>
            合计已含打包盒费 {formatYuan(packagingFeeFen)}；每笔外带订单只收一次。
          </p>
        )}
      </section>

      <section className="detail-block detail-block--status">
        <h3>状态轴</h3>
        <ol className="status-track">
          {STATUS_TRACK.map((step, index) => (
            <li
              key={step}
              aria-current={index === currentIndex ? 'step' : undefined}
              className={index === currentIndex ? 'status-track__step status-track__step--on' : 'status-track__step'}
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
            <p className="merchant-muted merchant-order-detail__cancel-label">
              {order.cancelRequest.status === 'PENDING'
                ? '学生申请取消，请优先处理：申请不等于已取消'
                : cancelRequestLabel(order.cancelRequest)}
            </p>
            {order.cancelRequest.reason && (
              <p className="merchant-muted">申请理由：{order.cancelRequest.reason}</p>
            )}
            {order.cancelRequest.decisionReason && (
              <p className="merchant-muted">处理理由：{order.cancelRequest.decisionReason}</p>
            )}
            {approveAction && rejectAction && (
              <>
                <div className="action-bar merchant-order-detail__cancel-actions">
                  <button
                    type="button"
                    className="action-button action-button--danger"
                    onClick={() => setCancelDecision((current) => (
                      current === 'APPROVE_CANCEL' ? null : 'APPROVE_CANCEL'
                    ))}
                    disabled={busy(approveAction)}
                    aria-expanded={cancelDecision === 'APPROVE_CANCEL'}
                    aria-controls="ready-order-cancel-decision-form"
                  >
                    {approveAction.label}
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--secondary"
                    onClick={() => setCancelDecision((current) => (
                      current === 'REJECT_CANCEL' ? null : 'REJECT_CANCEL'
                    ))}
                    disabled={busy(rejectAction)}
                    aria-expanded={cancelDecision === 'REJECT_CANCEL'}
                    aria-controls="ready-order-cancel-decision-form"
                  >
                    {rejectAction.label}
                  </button>
                </div>
                {cancelDecisionAction && (
                  <div className="merchant-order-detail__form" id="ready-order-cancel-decision-form">
                    <textarea
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="批准或拒绝都必须填写理由"
                      rows={2}
                      aria-label="取消申请处理理由"
                    />
                    <button
                      type="button"
                      className={`action-button ${cancelDecision === 'APPROVE_CANCEL' ? 'action-button--danger' : 'action-button--secondary'}`}
                      onClick={() => onAction(cancelDecisionAction, { reason: cancelReason })}
                      disabled={busy(cancelDecisionAction)}
                      aria-busy={busy(cancelDecisionAction) || undefined}
                    >
                      {busy(cancelDecisionAction) ? '提交中…' : `确认${cancelDecisionAction.label}`}
                    </button>
                    <p className="hint">批准会取消订单并模拟退款；申请不等于已取消。</p>
                  </div>
                )}
                {cancelError && (
                  <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
                    {cancelError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {order.diningModeChange.status !== 'NONE' && (
          <div className="detail-info-row" data-dining-mode-change={order.diningModeChange.status}>
            <h3>用餐方式申请</h3>
            <div className="detail-info-row__content">
              <p className="merchant-muted detail-emphasis">
                {diningModeChangeRoute(order.diningModeChange)}
              </p>
              <p className="merchant-muted">{diningModeChangeLabel(order.diningModeChange)}</p>
              {order.diningModeChange.reason && (
                <p className="merchant-muted">申请理由：{order.diningModeChange.reason}</p>
              )}
              {order.diningModeChange.decisionReason && (
                <p className="merchant-muted">处理理由：{order.diningModeChange.decisionReason}</p>
              )}
              {order.diningModeChange.status === 'PENDING' && (
                <p className="hint">请先确认打包或餐具安排；当前订单仍按原用餐方式记录。</p>
              )}
            </div>
          </div>
        )}
      </section>

      {verifyAction && (
        <section className="detail-block detail-block--verify">
          <h3>取餐码核销</h3>
          <p className="merchant-muted">档口不显示学生取餐码，请学生出示后手工输入。</p>
          <div className="inline-form">
            <input
              value={pickupCode}
              onChange={(event) => setPickupCode(event.target.value)}
              placeholder="输入学生出示的取餐码"
              aria-label="取餐码"
              autoComplete="off"
            />
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={() => onAction(verifyAction, { pickupCode })}
              disabled={busy(verifyAction)}
              aria-busy={busy(verifyAction) || undefined}
            >
              {busyLabel(verifyAction)}
            </button>
          </div>
          {errorFor('VERIFY') && (
            <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
              {errorFor('VERIFY')}
            </p>
          )}
          <p className="hint">输入学生出示的取餐码后提交；服务端校验订单状态与码，错误会原样提示。</p>
        </section>
      )}

      <section className="detail-block detail-block--delay">
        <h3>延迟</h3>
        <p className="merchant-muted">
          {order.delay
            ? `${order.delay.reason} · 预计 ${formatDateTime(order.delay.expectedReadyAt)} 可取`
            : '未设置延迟'}
        </p>
        {delayAction && (
          <>
            <button
              type="button"
              className="merchant-order-detail__secondary-action"
              onClick={() => setShowDelayForm((current) => !current)}
              aria-expanded={showDelayForm}
              aria-controls="ready-order-delay-form"
            >
              {showDelayForm ? '收起延迟填写' : delayAction.label}
            </button>
            {showDelayForm && (
              <div className="merchant-order-detail__form" id="ready-order-delay-form">
                <label>
                  <span>延迟原因</span>
                  <textarea
                    value={delayReason}
                    onChange={(event) => setDelayReason(event.target.value)}
                    placeholder="例如：当前订单较多，出餐延后"
                    rows={2}
                    aria-label="延迟原因"
                  />
                </label>
                <label>
                  <span>预计可取时间</span>
                  <input
                    type="datetime-local"
                    value={delayExpectedReadyAt}
                    onChange={(event) => setDelayExpectedReadyAt(event.target.value)}
                    aria-label="预计可取时间"
                  />
                </label>
                <button
                  type="button"
                  className="action-button action-button--secondary"
                  onClick={() => onAction(delayAction, {
                    reason: delayReason,
                    expectedReadyAt: delayExpectedReadyAt,
                  })}
                  disabled={busy(delayAction)}
                  aria-busy={busy(delayAction) || undefined}
                >
                  {busy(delayAction) ? '提交中…' : '确认填写延迟'}
                </button>
              </div>
            )}
            {errorFor('SET_DELAY') && (
              <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
                {errorFor('SET_DELAY')}
              </p>
            )}
          </>
        )}
      </section>

      <section className="detail-block detail-block--dining">
        <h3>用餐方式</h3>
        <p className="detail-emphasis">{dining.label} · {dining.description}</p>
        {order.diningModeReason && <p className="merchant-muted">变更理由：{order.diningModeReason}</p>}
        <p className="hint">用餐方式由学生选择；学生可申请变更，档口按确认后的方式备餐。</p>
      </section>

      <section className="detail-block detail-block--operations">
        <h3>操作</h3>
        {stockCancelAction && (
          <>
            <div className="merchant-order-detail__action-grid">
              <button
                type="button"
                className="action-button action-button--danger"
                onClick={() => setShowStockCancelForm((current) => !current)}
                disabled={busy(stockCancelAction)}
                aria-expanded={showStockCancelForm}
                aria-controls="ready-order-stock-cancel-form"
              >
                {showStockCancelForm ? '收起缺货取消' : stockCancelAction.label}
              </button>
            </div>
            {showStockCancelForm && (
              <div className="merchant-order-detail__form" id="ready-order-stock-cancel-form">
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
          </>
        )}
      </section>
    </div>
  );
}