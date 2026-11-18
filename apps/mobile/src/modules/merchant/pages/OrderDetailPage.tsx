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
  cancellationNote,
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
import { customizationSummary, formatYuan, totalQuantity } from '../utils/money';
import NewOrderDetailPage from './NewOrderDetailPage';
import ReadyOrderDetailPage from './ReadyOrderDetailPage';

interface OrderDetailPageProps {
  order: MerchantOrder;
  mode: 'sample' | 'real';
  onBack: () => void;
  onAction: (action: OrderAction, input?: ActionInput) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  pendingCode?: string | null;
  actionError?: { code: string; message: string } | null;
}

export default function OrderDetailPage(props: OrderDetailPageProps) {
  if (props.order.status === 'NEW') {
    return <NewOrderDetailPage {...props} />;
  }
  if (props.order.status === 'READY') {
    return <ReadyOrderDetailPage {...props} />;
  }
  return <OrderDetailContent {...props} />;
}

function OrderDetailContent({
order,
  mode,
  onBack,
  onAction,
  onRefresh,
  refreshing = false,
  pendingCode = null,
  actionError = null,
}: OrderDetailPageProps) {
  const [pickupCode, setPickupCode] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [stockCancelReason, setStockCancelReason] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [delayExpectedReadyAt, setDelayExpectedReadyAt] = useState('');


  const actions = getOrderActions(order);
  const primary = getPrimaryAction(order);
  const verifyAction = actions.find((action) => action.code === 'VERIFY');
  const approveAction = actions.find((action) => action.code === 'APPROVE_CANCEL');
  const rejectAction = actions.find((action) => action.code === 'REJECT_CANCEL');
  const stockCancelAction = actions.find((action) => action.code === 'CANCEL_ORDER');
  const delayAction = actions.find((action) => action.code === 'SET_DELAY');

  const mainActions = actions.filter(
    (action) => action.kind === 'primary' && action.code !== 'VERIFY' && action.code !== 'CANCEL_ORDER',
  );
  const busy = (action: OrderAction | undefined) => Boolean(action) && pendingCode === action?.code;
  const busyLabel = (action: OrderAction | undefined) => (busy(action) ? '提交中…' : action?.label);
  const errorFor = (code: string) => (actionError?.code === code ? actionError.message : null);
  const cancelError = errorFor('APPROVE_CANCEL') ?? errorFor('REJECT_CANCEL');
  const otherError = actionError
    && !['VERIFY', 'APPROVE_CANCEL', 'REJECT_CANCEL', 'CANCEL_ORDER', 'SET_DELAY']
      .includes(actionError.code)
    ? actionError.message
    : null;

  const status = statusView(order.status);
  const dining = diningModeView(order.diningMode);
  const currentIndex = STATUS_TRACK.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const isEmptyOperation = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const emptyText = order.status === 'CANCELLED'
    ? '订单已取消，无可用操作'
    : order.status === 'COMPLETED' ? '订单已完成，无可用操作' : '当前没有可用的主操作';

  return (
    <div className="merchant-view" data-order-id={order.id} data-order-status={order.status}>
      <div className="merchant-order-detail__topbar">
        <button type="button" className="back-link merchant-order-detail__back" onClick={onBack}>← 返回订单列表</button>
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
          <p className="detail-id__full">当天第 {order.orderNo ?? '—'} 单</p>
        </div>
        <div className="detail-tags">
          <span className={`merchant-tag merchant-tag--${status.tone}`}>{status.label}</span>
          {isCancelled && order.paymentStatus === 'SIMULATED_REFUNDED' && (
            <span className="merchant-flag merchant-flag--refund" data-payment-status="SIMULATED_REFUNDED">
              模拟退款
            </span>
          )}
        </div>
        <div className={`detail-dining detail-dining--${dining.tone}`} data-dining-mode={order.diningMode}>
          <span className="detail-dining__label">用餐方式</span>
          <strong className="detail-dining__value">{dining.label}</strong>
          <span className="detail-dining__desc">{dining.description}</span>
        </div>
        {order.cancelRequest.status === 'PENDING' && (
          <p className="detail-alert">学生申请取消，请优先处理；申请不等于已取消。</p>
        )}
        {order.diningModeChange.status === 'PENDING' && (
          <p className="detail-alert" data-dining-mode-change="PENDING">
            学生申请更改用餐方式：{diningModeChangeRoute(order.diningModeChange)}，请优先确认。
          </p>
        )}
        <p className="detail-next">下一步：{primary ? primary.label : emptyText}</p>
      </header>

      <section className="detail-block">
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

      <section className="detail-block">
        <h3>菜品与金额</h3>
        <ul className="detail-items">
          {order.items.map((item) => (
            <li key={item.dishId}>
              <span>
                {item.name} ×{item.quantity}
                {customizationSummary(item) ? (
                  <small className="detail-item__custom">配菜：{customizationSummary(item)}</small>
                ) : null}
              </span>
              <span>{formatYuan(item.unitPriceFen)}/份</span>
            </li>
          ))}
        </ul>
        <p className="detail-total">
          总份数 <strong>{totalQuantity(order.items)}</strong> 份 · 合计 <strong>{formatYuan(order.totalFen)}</strong>
        </p>
      </section>

      <section className="detail-block">
        <h3>状态轴</h3>
        {isCancelled ? (
          <p className="detail-alert">订单已取消：{cancellationNote(order)}</p>
        ) : (
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
        )}
      </section>

      <section className="detail-block">
        <h3>时间</h3>
        <ul className="detail-times">
          <li>创建：{formatDateTime(order.createdAt)}</li>
          <li>更新：{formatDateTime(order.updatedAt)}</li>
          <li>取餐：{order.pickedUpAt ? formatDateTime(order.pickedUpAt) : '尚未取餐'}</li>
        </ul>
      </section>

      <section className="detail-block">
        <h3>支付</h3>
        <p className="merchant-muted" data-payment-status={order.paymentStatus}>{paymentText(order.paymentStatus)}</p>
        {isCancelled && (
          <p className="hint">已取消订单保留在列表与详情中，不随状态变化消失。</p>
        )}
      </section>

      {verifyAction && (
        <section className="detail-block">
          <h3>取餐码核销</h3>
          <p className="merchant-muted">档口不显示学生取餐码，请学生出示后手工输入。</p>
          <div className="inline-form">
            <input
              value={pickupCode}
              onChange={(event) => setPickupCode(event.target.value)}
              placeholder="输入学生出示的取餐码"
              aria-label="取餐码"
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
          <p className="hint">
            {mode === 'real'
              ? '输入学生出示的取餐码后提交；服务端校验订单状态与码，错误会原样提示。'
              : '第 2—3 天接入服务后可用；当前点击只显示接口提示，不会核销成功。'}
          </p>
        </section>
      )}

      <section className="detail-block">
        <h3>取消申请</h3>
        <p className="merchant-muted">{cancelRequestLabel(order.cancelRequest)}</p>
        {order.cancelRequest.reason && (
          <p className="merchant-muted">
            申请理由：{order.cancelRequest.reason}
          </p>
        )}
        {order.cancelRequest.decisionReason && (
          <p className="merchant-muted">
            处理理由：{order.cancelRequest.decisionReason}
          </p>
        )}
        {approveAction && rejectAction && (
          <>
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
            <p className="hint">
              批准会取消订单并模拟退款；申请不等于已取消。
              {mode === 'real' ? '处理结果保存后学生端可读取同一订单。' : ''}
            </p>
          </>
        )}
      </section>

      {order.diningModeChange.status !== 'NONE' && (
        <section className="detail-block" data-dining-mode-change={order.diningModeChange.status}>
          <h3>用餐方式申请</h3>
          <p className="detail-emphasis">{diningModeChangeRoute(order.diningModeChange)}</p>
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
        </section>
      )}

      {stockCancelAction && (
        <section className="detail-block">
          <h3>缺货取消</h3>
          <p className="merchant-muted">
            仅未结束订单可取消；取消后模拟退款，并返还菜品库存。
          </p>
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
            {busyLabel(stockCancelAction)}
          </button>
          {errorFor('CANCEL_ORDER') && (
            <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
              {errorFor('CANCEL_ORDER')}
            </p>
          )}
          <p className="hint">
            {mode === 'real'
              ? '提交后由服务端判断状态与版本，失败会原样提示。'
              : '样例模式只显示接口提示，不会取消订单。'}
          </p>
        </section>
      )}

      <section className="detail-block">
        <h3>延迟</h3>
        {order.delay ? (
          <p className="merchant-muted">
            {order.delay.reason} · 预计 {formatDateTime(order.delay.expectedReadyAt)} 可取
          </p>
        ) : (
          <p className="merchant-muted">未设置延迟</p>
        )}
        {delayAction && (
          <>
            <p className="merchant-muted">延迟原因</p>
            <textarea
              value={delayReason}
              onChange={(event) => setDelayReason(event.target.value)}
              placeholder="例如：当前订单较多，出餐延后"
              rows={2}
              aria-label="延迟原因"
            />
            <p className="merchant-muted">预计可取时间</p>
            <input
              type="datetime-local"
              value={delayExpectedReadyAt}
              onChange={(event) => setDelayExpectedReadyAt(event.target.value)}
              aria-label="预计可取时间"
            />
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
              {busyLabel(delayAction)}
            </button>
            {errorFor('SET_DELAY') && (
              <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
                {errorFor('SET_DELAY')}
              </p>
            )}
            <p className="hint">
              延迟不改变主状态，学生可读取原因与预计时间。
              {mode === 'sample' ? '样例模式只显示接口提示。' : ''}
            </p>
          </>
        )}
      </section>

      <section className="detail-block">
        <h3>用餐方式</h3>
        <p className="detail-emphasis">{dining.label} · {dining.description}</p>
        {order.diningModeReason && (
          <p className="merchant-muted">变更理由：{order.diningModeReason}</p>
        )}
        <p className="hint">用餐方式由学生下单时选择，档口不可修改。</p>

      </section>

      <section className="detail-block">
        <h3>操作</h3>
        <ActionBar
          actions={mainActions}
          onAction={onAction}
          emptyText={emptyText}
          mode={mode}
          pendingCode={pendingCode}
          errorText={otherError}
        />
        {isEmptyOperation && (
          <p className="hint">终态订单只读，不显示接单、制作或核销按钮。</p>
        )}
      </section>
    </div>
  );
}