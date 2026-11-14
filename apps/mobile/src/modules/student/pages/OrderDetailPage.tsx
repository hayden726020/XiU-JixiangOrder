import { useEffect, useRef, useState } from 'react';
import { clearSession } from '../../../shared/session';
import type { CrowdView } from '../utils/crowdView';
import type { SourceError, StudentOrder, StudentSource } from '../types';
import { toSourceError } from '../types';
import {
  classifyRefreshFailure,
  createReadGuard,
  failInitialRead,
  failRefresh,
  initialDetailRead,
  settleRead,
  startInitialRead,
  startRefresh,
  type DetailReadState,
} from '../state/orderRead';
import { useOrderPolling } from '../state/useOrderPolling';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import {
  initialCancelState,
  isCancelSubmitting,
  reduceCancel,
  validateCancelReason,
  type CancelState,
} from '../state/orderCancel';
import { toCrowdView } from '../utils/crowdView';
import { deriveDetailReadView } from '../utils/detailReadView';
import { toDetailErrorView } from '../utils/detailErrorView';
import {
  CANCEL_CONFIRM_TEXT,
  CANCEL_REASON_LABEL,
  CANCEL_REASON_PLACEHOLDER,
  cancelErrorText,
  isCancelAuthCode,
  isCancelConflictCode,
  isCancelForbiddenCode,
  isCancelRetryableCode,
} from '../utils/cancelTexts';
import { CANCEL_RULES, CHANGE_DINING_NOTE } from '../utils/orderDetailTexts';
import { deriveCancelAreaView } from '../utils/orderCancelView';
import { toOrderStatusView } from '../utils/orderStatusView';
import { derivePollingView } from '../utils/pollingView';
import {
  buildCancelFingerprint,
  CANCEL_REQUEST_PREFIX,
  createRequestIdKeeper,
} from '../utils/requestId';
import { ORDER_SHOP_LABEL } from '../utils/shopTexts';
import DemoModeNotice from '../components/DemoModeNotice';
import LoginGuide from '../components/LoginGuide';
import OrderCrowdNote from '../components/OrderCrowdNote';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';

export interface OrderDetailPageProps {
  source: StudentSource;
  orderId: string;
  onBack: () => void;
  backLabel?: string;
}

type ReadKind = 'auto' | 'manual';

export default function OrderDetailPage({
  source,
  orderId,
  onBack,
  backLabel = '← 返回菜单',
}: OrderDetailPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [readState, setReadState] = useState<DetailReadState>(() => initialDetailRead());
  const [crowd, setCrowd] = useState<CrowdView | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const guardRef = useRef(createReadGuard());
  const stateRef = useRef<DetailReadState>(readState);
  stateRef.current = readState;
  const inFlightRef = useRef<{ kind: ReadKind; token: number } | null>(null);
  const runReadRef = useRef<(kind: ReadKind) => void>(() => {
    return;
  });
  const [cancelState, setCancelState] = useState<CancelState>(() => initialCancelState());
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBlocked, setCancelBlocked] = useState(false);
  const cancelKeeperRef = useRef(createRequestIdKeeper({ prefix: CANCEL_REQUEST_PREFIX }));
  const cancelSubmittingRef = useRef(false);

  const realLoggedOut = source.mode === 'real' && !gate.usable;

  const polling = useOrderPolling({
    enabled: source.mode === 'real' && gate.usable,
    offReason: source.mode === 'sample' ? 'sample' : 'blocked',
    onAutoRead: () => {
      runReadRef.current('auto');
    },
  });
  const pollingRef = useRef(polling);
  pollingRef.current = polling;

  useEffect(() => {
    if (realLoggedOut) {
      return;
    }
    const guard = guardRef.current;
    const token = guard.next();
    inFlightRef.current = null;
    setReadState((current) => startInitialRead(current));
    setCrowd(null);
    source.getOrder(orderId).then(
      (data) => {
        if (!guard.isCurrent(token)) {
          return;
        }
        setReadState((current) => settleRead(current, data, new Date()));
        pollingRef.current.notifyInitialSuccess(data);
        source.getCrowd(data.slotId).then(
          (reference) => {
            if (guard.isCurrent(token)) {
              setCrowd(toCrowdView(reference));
            }
          },
          () => {
            if (guard.isCurrent(token)) {
              setCrowd(null);
            }
          },
        );
      },
      (failure: unknown) => {
        if (!guard.isCurrent(token)) {
          return;
        }
        setReadState((current) => failInitialRead(current, toSourceError(failure)));
        pollingRef.current.notifyInitialFailure();
      },
    );
    return () => {
      guard.reset();
    };
  }, [source, orderId, realLoggedOut, reloadToken]);

  function settleFromRead(token: number, data: Parameters<typeof settleRead>[1]): void {
    const pending = inFlightRef.current;
    if (pending === null || pending.token !== token || !guardRef.current.isCurrent(token)) {
      if (pending !== null && pending.kind === 'auto') {
        pollingRef.current.notifyAutoDropped();
      }
      return;
    }
    const kind = pending.kind;
    inFlightRef.current = null;
    setReadState((current) => settleRead(current, data, new Date()));
    if (kind === 'manual') {
      pollingRef.current.notifyManualSuccess(data);
    } else {
      pollingRef.current.notifyAutoSuccess(data);
    }
  }

  function failFromRead(token: number, failure: unknown): void {
    const pending = inFlightRef.current;
    if (pending === null || pending.token !== token || !guardRef.current.isCurrent(token)) {
      if (pending !== null && pending.kind === 'auto') {
        pollingRef.current.notifyAutoDropped();
      }
      return;
    }
    const kind = pending.kind;
    inFlightRef.current = null;
    const error: SourceError = toSourceError(failure);
    if (kind === 'manual') {
      const failureKind = classifyRefreshFailure(error);
      setReadState((current) => failRefresh(current, error, failureKind));
      pollingRef.current.notifyManualFailure(error, failureKind);
      return;
    }
    if (classifyRefreshFailure(error) === 'terminal') {
      setReadState((current) => failRefresh(current, error, 'terminal'));
    }
    pollingRef.current.notifyAutoFailure(error);
  }

  function runRead(kind: ReadKind): void {
    if (source.mode !== 'real' || realLoggedOut) {
      return;
    }
    const current = stateRef.current;

    if (kind === 'auto') {
      if (current.phase !== 'ready' || inFlightRef.current !== null) {
        if (inFlightRef.current === null || inFlightRef.current.kind === 'auto') {
          pollingRef.current.notifyAutoDropped();
        }
        return;
      }
      const token = guardRef.current.next();
      inFlightRef.current = { kind: 'auto', token };
      source.getOrder(orderId).then(
        (data) => settleFromRead(token, data),
        (failure: unknown) => failFromRead(token, failure),
      );
      return;
    }

    if (inFlightRef.current !== null) {
      if (inFlightRef.current.kind === 'auto') {
        inFlightRef.current = { kind: 'manual', token: inFlightRef.current.token };
        setReadState((state) => startRefresh(state));
        pollingRef.current.notifyManualStart();
      }
      return;
    }

    if (current.phase !== 'ready' && current.phase !== 'refreshFailed') {
      return;
    }
    setReadState((state) => startRefresh(state));
    pollingRef.current.notifyManualStart();
    const token = guardRef.current.next();
    inFlightRef.current = { kind: 'manual', token };
    source.getOrder(orderId).then(
      (data) => settleFromRead(token, data),
      (failure: unknown) => failFromRead(token, failure),
    );
  }

  runReadRef.current = runRead;

  useEffect(() => {
    if (gate.usable && cancelState.phase === 'blocked-auth') {
      setCancelState(initialCancelState());
    }
  }, [gate.usable, cancelState.phase]);

  function applyOrderFromWrite(next: StudentOrder): void {
    guardRef.current.next();
    inFlightRef.current = null;
    setReadState((current) => settleRead(current, next, new Date()));
    pollingRef.current.notifyManualSuccess(next);
  }

  function openCancelConfirm(): void {
    if (cancelSubmittingRef.current) {
      return;
    }
    setCancelState((current) => reduceCancel(current, { type: 'open-confirm' }));
  }

  function closeCancelConfirm(): void {
    setCancelState((current) => reduceCancel(current, { type: 'cancel-confirm' }));
  }

  function submitCancel(): void {
    const order = stateRef.current.order;
    if (!order || cancelSubmittingRef.current || cancelBlocked) {
      return;
    }

    const isApply = order.status !== 'NEW';
    let reason = '';
    if (isApply) {
      const checked = validateCancelReason(cancelReason);
      if (!checked.ok) {
        setCancelState({
          phase: 'failed',
          message: checked.message,
          requestId: null,
        });
        return;
      }
      reason = checked.reason;
    }

    const requestId = cancelKeeperRef.current.ensure(
      buildCancelFingerprint({ orderId: order.id, reason }),
    );
    cancelSubmittingRef.current = true;
    setCancelState({ phase: 'submitting', message: '', requestId });

    source
      .cancelOrder({
        orderId: order.id,
        requestId,
        expectedVersion: order.version,
        ...(isApply ? { reason } : {}),
      })
      .then(
        (next) => {
          cancelSubmittingRef.current = false;
          applyOrderFromWrite(next);
          setCancelState(initialCancelState());
          setCancelBlocked(false);
          setCancelReason('');
        },
        (failure: unknown) => {
          cancelSubmittingRef.current = false;
          const error = toSourceError(failure);
          if (isCancelAuthCode(error.code)) {
            clearSession();
            setCancelState({
              phase: 'blocked-auth',
              message: '登录已失效，请重新登录后继续。',
              requestId,
            });
            refresh();
            return;
          }
          if (isCancelForbiddenCode(error.code)) {
            cancelKeeperRef.current.complete();
            setCancelBlocked(true);
            setCancelState({
              phase: 'failed',
              message: cancelErrorText(error.code),
              requestId: null,
            });
            return;
          }
          if (isCancelConflictCode(error.code)) {
            cancelKeeperRef.current.complete();
            setCancelState({
              phase: 'conflict-read',
              message: cancelErrorText(error.code),
              requestId: null,
            });
            runRead('manual');
            return;
          }
          if (error.retryable || isCancelRetryableCode(error.code)) {
            setCancelState((current) =>
              reduceCancel(current, { type: 'retryable-fail' }),
            );
            return;
          }
          cancelKeeperRef.current.complete();
          setCancelState({
            phase: 'failed',
            message: cancelErrorText(error.code),
            requestId: null,
          });
        },
      );
  }

  const errorView = toDetailErrorView(readState.error);
  const readView = deriveDetailReadView(readState, source.mode);
  const pollingView = derivePollingView(polling.state, {
    mode: source.mode,
    hasOrder: readState.order !== null,
    lastReadAt: readState.lastReadAt,
  });
  const statusView =
    readState.order !== null ? toOrderStatusView(readState.order, { mode: source.mode }) : null;
  const cancelArea =
    readState.order !== null
      ? deriveCancelAreaView(readState.order, { mode: source.mode })
      : null;
  const cancelAuthBlocked = cancelState.phase === 'blocked-auth';
  const cancelBusy = isCancelSubmitting(cancelState.phase);

  if (realLoggedOut) {
    return (
      <section className="student-page" aria-labelledby="student-order-title">
        <RealModeNotice />
        <button type="button" className="student-secondary student-back" onClick={onBack}>
          {backLabel}
        </button>
        <header className="student-page__head">
          <p className="student-kicker">真实模式 · 只读订单</p>
          <h2 id="student-order-title">订单详情</h2>
        </header>
        <LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} />
      </section>
    );
  }

  return (
    <section className="student-page" aria-labelledby="student-order-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <button type="button" className="student-secondary student-back" onClick={onBack}>
        {backLabel}
      </button>

      <header className="student-page__head">
        <p className="student-kicker">
          {source.mode === 'real' ? '真实模式 · 只读订单' : 'S6 · 订单详情（只读）'}
        </p>
        <h2 id="student-order-title">订单详情</h2>
        <p className="student-page__lead">
          {source.mode === 'real'
            ? '只读展示服务端订单；状态与取餐码按返回展示。'
            : '只读展示样例订单；当前不会发生真实取餐或资金交易。'}
        </p>
      </header>

      {source.mode === 'real' && gate.usable ? (
        <p className="student-session-note">当前登录：{gate.identityText}（仅用于核对）</p>
      ) : null}

      {readState.phase === 'reading' ? (
        <p className="student-loading">正在读取订单信息…</p>
      ) : null}

      {readState.phase === 'error' && errorView && errorView.action !== 'login' ? (
        <div className="student-error" role="alert">
          <p>{errorView.message}</p>
          <div className="student-error__actions">
            <button
              type="button"
              className="student-secondary"
              onClick={
                errorView.action === 'back-to-menu'
                  ? onBack
                  : () => setReloadToken((value) => value + 1)
              }
            >
              {errorView.action === 'back-to-menu' ? '返回菜单' : errorView.actionLabel}
            </button>
          </div>
        </div>
      ) : null}

      {readState.order !== null && statusView ? (
        <>
          <section className="student-order-head" aria-label="订单状态">
            <span className="student-status-badge">{statusView.statusLabel}</span>
            {statusView.demoLabel ? (
              <span className="student-order-demo">{statusView.demoLabel}</span>
            ) : null}
            <p className="student-order-id">订单号 {statusView.orderId}</p>
          </section>

          {readView.showRefreshEntry ? (
            <section className="student-refresh" aria-label="刷新订单状态">
              <button
                type="button"
                className="student-secondary"
                disabled={!readView.canRefresh}
                onClick={() => runRead('manual')}
              >
                {readView.refreshButtonText}
              </button>
              <p className="student-order-note">
                点击后会重新读取本单最新状态；不会改变订单。
              </p>
              <p
                className="student-polling"
                hidden={!pollingView.showText}
                data-polling-state={pollingView.stateAttr}
                data-polling-reason={pollingView.reasonAttr}
                role={pollingView.tone === 'none' ? undefined : 'status'}
                aria-live={pollingView.tone === 'active' ? 'off' : 'polite'}
              >
                {pollingView.text}
              </p>
              {pollingView.lastReadText ? (
                <p className="student-order-note">{pollingView.lastReadText}</p>
              ) : null}
              {readView.refreshNoticeText ? (
                <p className="student-error__inline" role="status">
                  {readView.refreshNoticeText}
                </p>
              ) : null}
              {readView.lastReadText ? (
                <p className="student-order-note">{readView.lastReadText}</p>
              ) : null}
            </section>
          ) : null}

          {statusView.status === 'CANCELLED' ? (
            <section className="student-cancel-path" aria-label="取消路径">
              <p className="student-cancel-path__title">订单已取消</p>
              <p className="student-cancel-path__reason">
                {statusView.cancelText || '未提供取消原因'}
              </p>
            </section>
          ) : (
            <section aria-labelledby="student-timeline-title">
              <h3 id="student-timeline-title" className="student-section-title">
                订单进度
              </h3>
              <ol className="student-timeline">
                {statusView.steps.map((step) => (
                  <li
                    key={step.name}
                    className={`student-timeline__step${step.reached ? ' is-reached' : ''}${
                      step.current ? ' is-current' : ''
                    }`}
                  >
                    <span className="student-timeline__dot" aria-hidden="true" />
                    <span className="student-timeline__name">{step.name}</span>
                  </li>
                ))}
              </ol>
              {statusView.delayText ? (
                <p className="student-order-note">{statusView.delayText}</p>
              ) : null}
              {statusView.pickedUpText ? (
                <p className="student-order-note">{statusView.pickedUpText}</p>
              ) : null}
            </section>
          )}

          <section className="student-confirm" aria-labelledby="student-order-items-title">
            <h3 id="student-order-items-title" className="student-section-title">
              菜品与金额
            </h3>
            <ul className="student-confirm__lines">
              {statusView.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="student-confirm__line">
                  <div>
                    <p className="student-confirm__name">
                      {item.name} × {item.quantity}
                    </p>
                    <p className="student-confirm__meta">单价 {item.unitPriceText}</p>
                  </div>
                  <span className="student-confirm__amount">{item.subtotalText}</span>
                </li>
              ))}
            </ul>
            <p className="student-total">合计 {statusView.totalText}</p>
            <p className="student-total__note">
              金额为{source.mode === 'real' ? '服务端' : '样例服务端'}返回结果
            </p>
          </section>

          <section className="student-info" aria-label="预约与订单信息">
            <p className="student-info__row">
              <span>{ORDER_SHOP_LABEL}</span>
              <span>{statusView.shop.text}</span>
            </p>
            {statusView.shop.note ? (
              <p className="student-order-note">{statusView.shop.note}</p>
            ) : null}
            <p className="student-info__row">
              <span>时段</span>
              <span>{statusView.slotRangeText || '未提供'}</span>
            </p>
            <p className="student-info__row">
              <span>用餐方式</span>
              <span>{statusView.diningModeText}</span>
            </p>
            <p className="student-info__row">
              <span>创建时间</span>
              <span>{statusView.createdText || '未提供'}</span>
            </p>
            {source.mode === 'real' ? (
              <p className="student-info__row">
                <span>订单更新时间（服务端）</span>
                <span>
                  {statusView.updatedText
                    ? `${statusView.updatedText}${readView.updatedLabelSuffix}`
                    : '未提供'}
                </span>
              </p>
            ) : null}
          </section>

          {cancelArea && cancelArea.kind !== 'none' ? (
            <section
              className="student-cancel-action"
              data-cancel-kind={cancelArea.kind}
              aria-label="取消订单"
            >
              <h3 className="student-section-title">取消订单</h3>
              {cancelArea.noticeText ? (
                <p className="student-order-note" role="status">
                  {cancelArea.noticeText}
                </p>
              ) : null}
              {cancelArea.decisionReason ? (
                <p className="student-order-note">档口理由：{cancelArea.decisionReason}</p>
              ) : null}
              {cancelArea.kind === 'apply' || cancelArea.kind === 'rejected' ? (
                <label className="student-cancel-action__field">
                  <span>{CANCEL_REASON_LABEL}</span>
                  <textarea
                    value={cancelReason}
                    maxLength={200}
                    placeholder={CANCEL_REASON_PLACEHOLDER}
                    disabled={cancelBusy}
                    onChange={(event) => setCancelReason(event.target.value)}
                  />
                  <span className="student-order-note">{cancelReason.trim().length}/200</span>
                </label>
              ) : null}
              {cancelAuthBlocked ? (
                <LoginGuide
                  gate={gate}
                  reason="session-expired"
                  scope="detail"
                  onRecheck={() => {
                    refresh();
                    setCancelState(initialCancelState());
                  }}
                  onBack={onBack}
                />
              ) : null}
              {!cancelAuthBlocked && cancelArea.actionLabel && !cancelBlocked ? (
                cancelArea.kind === 'new' && cancelState.phase === 'confirming' ? (
                  <div className="student-cancel-action__confirm">
                    <p>{CANCEL_CONFIRM_TEXT}</p>
                    <div className="student-cancel-action__actions">
                      <button
                        type="button"
                        className="student-primary"
                        disabled={cancelBusy}
                        onClick={submitCancel}
                      >
                        确认取消
                      </button>
                      <button
                        type="button"
                        className="student-secondary"
                        disabled={cancelBusy}
                        onClick={closeCancelConfirm}
                      >
                        放弃
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={
                      cancelArea.kind === 'new' ? 'student-secondary' : 'student-primary'
                    }
                    disabled={cancelBusy || !cancelArea.actionEnabled}
                    onClick={cancelArea.kind === 'new' ? openCancelConfirm : submitCancel}
                  >
                    {cancelArea.actionLabel}
                  </button>
                )
              ) : null}
              {cancelState.message ? (
                <p className="student-error__inline" role="status">
                  {cancelState.message}
                </p>
              ) : null}
              {cancelBusy ? (
                <p className="student-order-note" role="status">
                  正在提交取消请求…
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="student-info" aria-label="取餐码">
            <p className="student-info__row">
              <span>取餐码</span>
              <span>{statusView.pickupCodeText}</span>
            </p>
            {statusView.pickupCodeNotice ? (
              <p className="student-order-note">{statusView.pickupCodeNotice}</p>
            ) : null}
          </section>

          <section className="student-rule" aria-label="取消规则">
            <h3 className="student-section-title">取消规则</h3>
            {CANCEL_RULES.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </section>

          <section className="student-rule" aria-label="变更用餐方式">
            <h3 className="student-section-title">变更用餐方式</h3>
            <p>{statusView.changeDiningRuleText}</p>
            <p>{CHANGE_DINING_NOTE}</p>
          </section>

          <section className="student-rule" aria-label="支付说明">
            <h3 className="student-section-title">支付说明</h3>
            <p>{statusView.paymentText}</p>
          </section>

          <OrderCrowdNote crowd={crowd} />
        </>
      ) : null}

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </section>
  );
}