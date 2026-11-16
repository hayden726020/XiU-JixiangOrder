import { useEffect, useRef, useState } from 'react';
import type { CrowdView } from '../utils/crowdView';
import type { SourceError, StudentSource } from '../types';
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
import { toCrowdView } from '../utils/crowdView';
import { deriveDetailReadView } from '../utils/detailReadView';
import { toDetailErrorView } from '../utils/detailErrorView';
import { CANCEL_RULES, CHANGE_DINING_NOTE } from '../utils/orderDetailTexts';
import { toOrderStatusView } from '../utils/orderStatusView';
import { derivePollingView } from '../utils/pollingView';
import { ORDER_SHOP_LABEL } from '../utils/shopTexts';
import DemoModeNotice from '../components/DemoModeNotice';
import LoginGuide from '../components/LoginGuide';
import OrderCrowdNote from '../components/OrderCrowdNote';
import RealModeNotice from '../components/RealModeNotice';
import SampleBanner from '../components/SampleBanner';
import '../order-detail.css';
import '../order-list.css';

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

  const errorView = toDetailErrorView(readState.error);
  const readView = deriveDetailReadView(readState, source.mode);
  const pollingView = derivePollingView(polling.state, {
    mode: source.mode,
    hasOrder: readState.order !== null,
    lastReadAt: readState.lastReadAt,
  });
  const statusView =
    readState.order !== null ? toOrderStatusView(readState.order, { mode: source.mode }) : null;
  const cancelRequestPending = readState.order?.cancelRequest.status === 'PENDING';

  if (realLoggedOut) {
    return (
      <main className="student-order-detail" aria-labelledby="student-order-title">
        <RealModeNotice />
        <nav className="order-nav">
          <button type="button" className="order-nav__back" onClick={onBack} aria-label={backLabel}><span aria-hidden="true">‹</span></button>
          <h1 id="student-order-title" className="order-nav__title">订单详情</h1>
          <div className="order-nav__placeholder" />
        </nav>
        <div style={{ padding: '1rem' }}><LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} /></div>
      </main>
    );
  }

  return (
    <main className="student-order-detail" aria-labelledby="student-order-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <nav className="order-nav">
        <button type="button" className="order-nav__back" onClick={onBack} aria-label={backLabel}><span aria-hidden="true">‹</span></button>
        <h1 id="student-order-title" className="order-nav__title">订单详情</h1>
        <div className="order-nav__placeholder" />
      </nav>

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
          <div className="order-detail-content">
          {statusView.status === 'READY' ? (
            <section className="order-ready-banner" aria-label="取餐通知">
              <div className="order-ready-banner__title-wrap"><h2 className="order-ready-banner__title">做好啦，来取餐吧！</h2><span className="order-ready-banner__sparkle" aria-hidden="true">✨</span>{cancelRequestPending ? <span className="order-status-card__tape-tag" role="status">取消申请待处理</span> : null}</div>
              <p className="order-ready-banner__sub">{statusView.shop.text} · 可取餐</p>
            </section>
          ) : (
            <section className="order-status-card" aria-label="订单状态">
              <div className="order-status-card__header"><div className="order-status-card__title-wrap"><h2 className="order-status-card__title">{statusView.statusLabel}</h2><span className="order-status-card__sparkles" aria-hidden="true">✨</span></div>{cancelRequestPending ? <span className="order-status-card__tape-tag" role="status">取消申请待处理</span> : null}</div>
              <p className="order-status-card__lead">{statusView.status === 'CANCELLED' ? '订单已取消' : '订单状态以服务端返回为准'}</p>
              <p className="order-status-card__sublead">{statusView.shop.text} · {statusView.slotRangeText || '时段信息未提供'}</p>
            </section>
          )}
          <section className="student-order-head" aria-label="订单编号">
            {statusView.demoLabel ? <span className="student-order-demo">{statusView.demoLabel}</span> : null}
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
            <section className="order-status-card" aria-labelledby="student-timeline-title">
              <h3 id="student-timeline-title" className="student-section-title">
                订单进度
              </h3>
              <ol className="order-steps-bar" aria-label="订单进度">
                <span className="order-steps-bar__line-bg" aria-hidden="true" />
                <span className="order-steps-bar__line-active" style={{ width: `${Math.max(0, statusView.activeIndex) * 25}%` }} aria-hidden="true" />
                {statusView.steps.map((step) => (
                  <li
                    key={step.name}
                    className={`order-step-node${step.reached ? ' is-reached' : ''}${
                      step.current ? ' is-current' : ''
                    }`}
                  >
                    <span className="order-step-node__circle" aria-hidden="true" />
                    <span className="order-step-node__name">{step.name}</span>
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

          {statusView.status === 'READY' && readState.order.pickupCode ? (
            <section className="pickup-ticket-card" aria-label="取餐码凭证">
              <div className="pickup-ticket-card__tape" aria-hidden="true" />
              <div className="pickup-ticket-card__notch-left" aria-hidden="true" />
              <div className="pickup-ticket-card__notch-right" aria-hidden="true" />
              <div className="pickup-ticket-card__title-box"><h3 className="pickup-ticket-card__title">取餐码</h3></div>
              <div className="pickup-ticket-card__code" aria-label={`取餐码 ${readState.order.pickupCode}`}>
                {readState.order.pickupCode.split('').map((character, index) => <span key={`${character}-${index}`}>{character}</span>)}
              </div>
              <p className="pickup-ticket-card__hint">向档口出示取餐码</p>
              <p className="pickup-ticket-card__subhint">{statusView.pickupCodeNotice}</p>
              <div className="pickup-ticket-card__divider" aria-hidden="true" />
              <div className="pickup-ticket-card__footer"><span>{statusView.slotRangeText}</span><span aria-hidden="true">|</span><span className="pickup-ticket-card__dining-tag">{statusView.diningModeText}</span></div>
            </section>
          ) : (
            <section className="student-info" aria-label="取餐码">
              <p className="student-info__row"><span>取餐码</span><span>{statusView.pickupCodeText}</span></p>
              {statusView.pickupCodeNotice ? <p className="student-order-note">{statusView.pickupCodeNotice}</p> : null}
            </section>
          )}

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
          </div>
        </>
      ) : null}

      {source.mode === 'sample' ? <DemoModeNotice /> : null}
    </main>
  );
}
