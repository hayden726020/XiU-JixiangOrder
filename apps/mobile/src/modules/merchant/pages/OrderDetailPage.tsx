import { useEffect, useState, type ReactNode } from 'react';

import type { MerchantOrder } from '../data/types';
import {
  getOrderActions,
  type ActionInput,
  type OrderAction,
} from '../state/actionMatrix';
import {

  cancellationNote,
  diningModeChangeLabel,
  diningModeChangeRoute,
  diningModeView,
  formatDateTime,
  formatSlot,
  hasPendingCancel,
  hasPendingDiningModeChange,
  localInputToZonedIso,
  orderNoLabel,
  paymentText,
  statusView,
} from '../state/orderView';
import { formatYuan, totalQuantity } from '../utils/money';
import OrderStatusTrack from '../components/OrderStatusTrack';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconClock3,
  IconGitCommitHorizontal,
  IconHistory,
  IconListOrdered,
  IconMessageSquareText,
  IconPackage,
  IconReceiptText,
  IconTimer,
  IconUtensils,
  IconWallet,
} from '../components/MerchantIcons';


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

const CANCEL_STATUS_TEXT: Record<string, string> = {
  NONE: '无取消申请',
  PENDING: '学生申请取消 · 待处理',
  APPROVED: '取消申请已批准',
  REJECTED: '取消申请已拒绝',
};

function flowActionLabel(action: OrderAction): string {
  if (action.code === 'ACCEPT') return '接单';
  if (action.code === 'START_PREPARING') return '开始制作';
  if (action.code === 'MARK_READY') return '完成制作';
  return action.label;
}

function flowActionHint(action: OrderAction): string {
  if (action.code === 'ACCEPT') return '接单后订单进入制作流程，学生端同步显示。';
  if (action.code === 'START_PREPARING') return '开始制作后订单进入制作中。';
  if (action.code === 'MARK_READY') return '完成后进入可取餐；仍需学生取餐核销才算完成。';
  return '';
}

function InfoRow({
  icon,
  label,
  value,
  extra,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="od-info__row">
      <span className="od-info__label">{icon}{label}</span>
      <span className="od-info__value">{value}</span>
      {extra && <span className="od-info__extra">{extra}</span>}
    </div>
  );
}

export default function OrderDetailPage({
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
  const [stockReason, setStockReason] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [delayAt, setDelayAt] = useState('');
  const [showStock, setShowStock] = useState(false);
  const [showDelay, setShowDelay] = useState(false);

  useEffect(() => {
    setPickupCode('');
    setCancelReason('');
    setStockReason('');
    setDelayReason('');
    setDelayAt('');
    setShowStock(false);
    setShowDelay(false);
  }, [order.id]);

  const actions = getOrderActions(order);
  const verifyAction = actions.find((action) => action.code === 'VERIFY');
  const approveAction = actions.find((action) => action.code === 'APPROVE_CANCEL');
  const rejectAction = actions.find((action) => action.code === 'REJECT_CANCEL');
  const stockCancelAction = actions.find((action) => action.code === 'CANCEL_ORDER');
  const delayAction = actions.find((action) => action.code === 'SET_DELAY');
  const flowAction = actions.find((action) => (
    action.code === 'ACCEPT'
    || action.code === 'START_PREPARING'
    || action.code === 'MARK_READY'
  )) ?? null;

  const pendingCancel = hasPendingCancel(order);
  const pendingChange = hasPendingDiningModeChange(order);
  const pending = pendingCancel || pendingChange;
  const isCancelled = order.status === 'CANCELLED';
  const isCompleted = order.status === 'COMPLETED';
  const isTerminal = isCancelled || isCompleted;
  const making = order.status === 'ACCEPTED' || order.status === 'PREPARING';
  const status = statusView(order.status);
  const headerLabel = making ? '制作中' : status.label;
  const headerTone = making ? 'in-progress' : status.tone;
  const dining = diningModeView(order.diningMode);
  const busy = (action?: OrderAction | null) => Boolean(action) && pendingCode === action?.code;
  const anyBusy = pendingCode !== null;

  const verifyError = actionError?.code === 'VERIFY' ? actionError.message : null;
  const pendingError = actionError && ['APPROVE_CANCEL', 'REJECT_CANCEL'].includes(actionError.code)
    ? actionError.message
    : null;
  const delayError = actionError?.code === 'SET_DELAY' ? actionError.message : null;
  const stockError = actionError?.code === 'CANCEL_ORDER' ? actionError.message : null;
  const flowError = actionError && ['ACCEPT', 'START_PREPARING', 'MARK_READY'].includes(actionError.code)
    ? actionError.message
    : null;

  const topHint = isCancelled
    ? '该订单已取消，无后续操作'
    : isCompleted
      ? '该订单已完成，信息只读'
      : pending
        ? '该订单存在待处理事项，请优先处理'
        : order.status === 'NEW'
          ? '等待接单，接单后进入制作流程'
          : order.status === 'ACCEPTED'
            ? '下一步：开始制作'
            : order.status === 'PREPARING'
              ? '正在制作，完成后标记可取餐'
              : order.status === 'READY'
                ? '餐品已备好，等待学生取餐并核销'
                : '按当前状态处理订单';

  const actionSectionHint = isCancelled
    ? '订单已取消'
    : isCompleted
      ? '订单已完成'
      : pending
        ? '请先处理待处理事项'
        : verifyAction
          ? '核销后完成订单'
          : '按当前状态操作';

  const cancelStatusText = CANCEL_STATUS_TEXT[order.cancelRequest.status] ?? '无取消申请';
  const diningIcon = order.diningMode === 'TAKEAWAY'
    ? <IconPackage size={17} />
    : <IconUtensils size={17} />;

  function toggleDelay() {
    if (!showDelay) {
      setDelayReason(order.delay?.reason ?? '');
      setDelayAt(order.delay?.expectedReadyAt?.slice(0, 16) ?? '');
    }
    setShowDelay((current) => !current);
  }

  return (
    <div
      className="merchant-view order-detail-v7"
      data-order-id={order.id}
      data-order-status={order.status}
      data-pending={pending ? 'true' : 'false'}
      data-cancelled={isCancelled ? 'true' : 'false'}
    >
      <div className="od-topbar">
        <button type="button" className="od-back" onClick={onBack}>
          <IconArrowLeft size={16} />
          返回订单列表
        </button>
        {mode === 'real' && (
          <button
            type="button"
            className="od-refresh"
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

      <header className="od-hero">
        <div className="od-hero__top">
          <div className="od-order-id">
            <span className="od-order-id__icon"><IconReceiptText size={18} /></span>
            <div>
              <strong>{orderNoLabel(order)}</strong>
              <small>{order.orderNo === null || order.orderNo === undefined
                ? '订单编号'
                : `当天第 ${order.orderNo} 单`}</small>
            </div>
          </div>
          <div className="od-badges">
            <span className={`od-badge od-badge--${headerTone}`}>{headerLabel}</span>
            {pending && (
              <span className="od-badge od-badge--pending">
                <i aria-hidden="true" />
                待处理
              </span>
            )}
            {order.demo || mode === 'sample' ? (
              <span className="od-source-tag">样例</span>
            ) : null}
          </div>
        </div>

        <div className="od-hero__meta">
          <div className="od-meta">
            <IconClock3 size={17} />
            <div>
              <span>预约时间</span>
              <strong>{formatSlot(order)}</strong>
            </div>
          </div>
          <div className="od-meta">
            {diningIcon}
            <div>
              <span>用餐方式</span>
              <strong>{dining.label}</strong>
              <small>{dining.description}</small>
            </div>
          </div>
        </div>

        <p className={`od-hero__hint${pending ? ' is-pending' : ''}`}>{topHint}</p>
      </header>

      <section className="od-card od-ticket" aria-label="菜品与金额">
        <header className="od-card__head">
          <h2><IconListOrdered size={18} />菜品与金额</h2>
          <span>{order.items.length} 种 · {totalQuantity(order.items)} 份</span>
        </header>
        <div className="od-ticket__columns" aria-hidden="true">
          <span>菜品</span>
          <span>数量</span>
          <span>单价</span>
        </div>
        <ul className="od-ticket__items">
          {order.items.map((item) => (
            <li key={item.dishId}>
              <span className="od-ticket__name">{item.name}</span>
              <span className="od-ticket__qty">×{item.quantity}</span>
              <span className="od-ticket__price">{formatYuan(item.unitPriceFen)}</span>
            </li>
          ))}
        </ul>
        <div className="od-ticket__summary">
          <span>总份数 <b>{totalQuantity(order.items)}</b> 份</span>
          <span className="od-ticket__total">合计 <b>{formatYuan(order.totalFen)}</b></span>
        </div>
        {typeof order.packagingFeeFen === 'number' && order.packagingFeeFen > 0 && (
          <p className="od-ticket__fee">含打包费 {formatYuan(order.packagingFeeFen)}</p>
        )}
        <div className={`od-note${order.remark ? ' has-note' : ' is-empty'}`}>
          <IconMessageSquareText size={16} />
          <div>
            <span>订单备注</span>
            <p>{order.remark || '学生未填写备注'}</p>
          </div>
        </div>
      </section>

      <section className="od-card od-progress-card" aria-label="订单进度与时间">
        <header className="od-card__head">
          <h2><IconGitCommitHorizontal size={18} />订单进度</h2>
          <span>{status.label}</span>
        </header>
        <OrderStatusTrack order={order} />
        <dl className="od-times">
          <div><dt>创建时间</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
          <div><dt>更新时间</dt><dd>{formatDateTime(order.updatedAt)}</dd></div>
          <div>
            <dt>{order.pickedUpAt ? '取餐核销' : '取餐时间'}</dt>
            <dd>{order.pickedUpAt ? formatDateTime(order.pickedUpAt) : '尚未取餐'}</dd>
          </div>
        </dl>
      </section>

      <section className="od-card od-info" aria-label="订单补充信息">
        <header className="od-card__head">
          <h2><IconHistory size={18} />订单信息</h2>
        </header>
        <div className="od-info__rows">
          <InfoRow
            icon={<IconWallet size={16} />}
            label="支付"
            value={(
              <>
                {paymentText(order.paymentStatus)}
                {order.paymentStatus === 'SIMULATED_REFUNDED' && (
                  <em className="od-refund-tag">模拟退款</em>
                )}
              </>
            )}
          />
          {!isCancelled && (
            <InfoRow
              icon={<IconCircleX size={16} />}
              label="取消申请"
              value={cancelStatusText}
            />
          )}
          {!isCancelled && order.cancelRequest.reason && order.cancelRequest.status !== 'PENDING' && (
            <p className="od-info__sub">申请原因：{order.cancelRequest.reason}</p>
          )}
          {!isCancelled && order.cancelRequest.decisionReason && (
            <p className="od-info__sub">处理理由：{order.cancelRequest.decisionReason}</p>
          )}
          <InfoRow
            icon={<IconTimer size={16} />}
            label="延迟"
            value={order.delay
              ? `${order.delay.reason} · 预计 ${formatDateTime(order.delay.expectedReadyAt)} 可取`
              : '未设置延迟'}
            extra={delayAction ? (
              <button type="button" className="od-text-button" onClick={toggleDelay}>
                {showDelay ? '收起' : order.delay ? '修改延迟' : '填写延迟'}
              </button>
            ) : null}
          />
        </div>

        {showDelay && delayAction && (
          <div className="od-form" data-delay-form>
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
                value={delayAt}
                onChange={(event) => setDelayAt(event.target.value)}
                aria-label="预计可取时间"
              />
            </label>
            <div className="od-form__actions">
              <button
                type="button"
                className="action-button action-button--secondary"
                onClick={() => onAction(delayAction, {
                  reason: delayReason,
                  expectedReadyAt: localInputToZonedIso(delayAt),
                })}
                disabled={anyBusy}
                aria-busy={busy(delayAction) || undefined}
              >
                {busy(delayAction) ? '提交中…' : '保存延迟'}
              </button>
            </div>
            {delayError && <p className="od-error" role="alert">{delayError}</p>}
            <p className="od-hint">延迟不改变订单主状态，学生可读取原因与预计时间。</p>
          </div>
        )}

        {pendingCancel && (
          <div className="od-pending-panel" data-pending-panel>
            <div className="od-pending-panel__head">
              <IconAlertTriangle size={17} />
              <strong>待处理事项</strong>
              <span>退款申请</span>
            </div>
            <p className="od-pending-panel__line">学生申请取消 · 订单金额 {formatYuan(order.totalFen)}</p>
            {order.cancelRequest.reason && (
              <p className="od-pending-panel__reason">申请原因：{order.cancelRequest.reason}</p>
            )}
            {order.cancelRequest.decisionReason && (
              <p className="od-pending-panel__reason">处理理由：{order.cancelRequest.decisionReason}</p>
            )}
            {order.status === 'READY' && (
              <p className="od-pending-panel__tip">订单已可取餐，退款不受理；请拒绝申请后核销取餐码。</p>
            )}
            {(approveAction || rejectAction) ? (
              <>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder={approveAction ? '批准或拒绝都必须填写理由' : '请填写拒绝理由'}
                  rows={2}
                  aria-label="取消申请处理理由"
                />
                <div className="od-form__actions">
                  {approveAction && (
                    <button
                      type="button"
                      className="action-button action-button--danger"
                      onClick={() => onAction(approveAction, { reason: cancelReason })}
                      disabled={anyBusy}
                      aria-busy={busy(approveAction) || undefined}
                    >
                      {busy(approveAction) ? '提交中…' : approveAction.label}
                    </button>
                  )}
                  {rejectAction && (
                    <button
                      type="button"
                      className="action-button action-button--secondary"
                      onClick={() => onAction(rejectAction, { reason: cancelReason })}
                      disabled={anyBusy}
                      aria-busy={busy(rejectAction) || undefined}
                    >
                      {busy(rejectAction) ? '提交中…' : rejectAction.label}
                    </button>
                  )}
                </div>
                {pendingError && <p className="od-error" role="alert">{pendingError}</p>}
                <p className="od-hint">
                  {approveAction
                    ? '批准会取消订单并模拟退款；申请不等于已取消。'
                    : '订单已可取餐，退款不受理；拒绝申请后请核销取餐码。'}
                  {mode === 'real' ? ' 处理结果保存后学生端读取同一订单。' : ''}
                </p>
              </>
            ) : (
              <p className="od-hint">请在订单列表的「待处理」分组中查看并处理该申请。</p>
            )}
          </div>
        )}

        {pendingChange && (
          <div className="od-pending-panel" data-pending-panel="dining-mode">
            <div className="od-pending-panel__head">
              <IconAlertTriangle size={17} />
              <strong>待处理事项</strong>
              <span>用餐方式变更</span>
            </div>
            <p className="od-pending-panel__line">
              {diningModeChangeRoute(order.diningModeChange)}
            </p>
            {order.diningModeChange?.reason && (
              <p className="od-pending-panel__reason">申请原因：{order.diningModeChange.reason}</p>
            )}
            <p className="od-hint">{diningModeChangeLabel(order.diningModeChange)}；当前流程请按线下确认结果处理。</p>
          </div>
        )}

        {isCancelled && (
          <div className="od-cancel-record">
            <div className="od-cancel-record__head">
              <IconCircleX size={17} />
              <strong>取消记录</strong>
              {order.paymentStatus === 'SIMULATED_REFUNDED' && (
                <em className="od-refund-tag">模拟退款</em>
              )}
            </div>
            <p>取消说明：{cancellationNote(order)}</p>
            {order.cancelRequest.reason && <p>申请原因：{order.cancelRequest.reason}</p>}
            {order.cancelRequest.decisionReason && <p>处理理由：{order.cancelRequest.decisionReason}</p>}
            <p className="od-hint">订单已终止，不再执行接单、制作或核销。</p>
          </div>
        )}
      </section>

      <section className={`od-card od-actions${isTerminal ? ' is-readonly' : ''}`} aria-label="订单操作">
        <header className="od-card__head">
          <h2><IconCircleCheck size={18} />操作</h2>
          <span>{actionSectionHint}</span>
        </header>

        {isTerminal ? (
          <p className="od-result">
            {isCancelled
              ? '该订单已取消，无后续操作。'
              : `该订单已完成${order.pickedUpAt ? `，取餐核销于 ${formatDateTime(order.pickedUpAt)}` : ''}。`}
          </p>
        ) : verifyAction && !pendingCancel ? (
          <div className="od-verify" data-verify-block>
            <label className="od-field">
              <span>取餐码</span>
              <div className="od-verify__row">
                <input
                  value={pickupCode}
                  onChange={(event) => setPickupCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !anyBusy) {
                      onAction(verifyAction, { pickupCode });
                    }
                  }}
                  placeholder="输入学生出示的取餐码"
                  aria-label="取餐码"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="action-button action-button--primary od-btn"
                  onClick={() => onAction(verifyAction, { pickupCode })}
                  disabled={anyBusy}
                  aria-busy={busy(verifyAction) || undefined}
                  data-verify-submit
                >
                  {busy(verifyAction) ? '核销中…' : '核销取餐'}
                </button>
              </div>
            </label>
            {verifyError && <p className="od-error" role="alert">{verifyError}</p>}
            <p className="od-hint">输入学生出示的取餐码后提交；核销成功后才进入已完成。</p>
          </div>
        ) : flowAction ? (
          <div className="od-primary-action">
            <button
              type="button"
              className="action-button action-button--primary od-btn od-btn--wide"
              onClick={() => onAction(flowAction)}
              disabled={anyBusy}
              aria-busy={busy(flowAction) || undefined}
              data-flow-action={flowAction.code}
            >
              {busy(flowAction) ? '提交中…' : (
                <>
                  <IconCheck size={16} />
                  {flowActionLabel(flowAction)}
                </>
              )}
            </button>
            <p className="od-hint">{flowActionHint(flowAction)}</p>
            {flowError && <p className="od-error" role="alert">{flowError}</p>}
          </div>
        ) : pending ? (
          <p className="od-result">请先处理上方待处理事项。</p>
        ) : (
          <p className="od-result">当前状态没有可执行的主操作。</p>
        )}

        {!isTerminal && stockCancelAction && (
          <div className="od-danger" data-stock-cancel>
            <button
              type="button"
              className="od-text-button od-text-button--danger"
              onClick={() => setShowStock((current) => !current)}
              disabled={anyBusy}
              aria-expanded={showStock}
            >
              {showStock ? '收起缺货取消' : '缺货取消'}
            </button>
            {showStock && (
              <div className="od-form">
                <label>
                  <span>缺货原因</span>
                  <textarea
                    value={stockReason}
                    onChange={(event) => setStockReason(event.target.value)}
                    placeholder="填写缺货原因"
                    rows={2}
                    aria-label="缺货取消原因"
                  />
                </label>
                <div className="od-form__actions">
                  <button
                    type="button"
                    className="action-button action-button--danger"
                    onClick={() => onAction(stockCancelAction, { reason: stockReason })}
                    disabled={anyBusy}
                    aria-busy={busy(stockCancelAction) || undefined}
                  >
                    {busy(stockCancelAction) ? '提交中…' : '确认缺货取消'}
                  </button>
                </div>
                {stockError && <p className="od-error" role="alert">{stockError}</p>}
                <p className="od-hint">仅未结束订单可取消；取消后按服务端规则返还库存与未开始时段的 1 个名额。</p>
              </div>
            )}
          </div>
        )}

        {isCompleted && (
          <p className="od-hint">已完成订单只读，不显示接单、制作或核销按钮。</p>
        )}
      </section>
    </div>
  );
}