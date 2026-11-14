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
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import { toCrowdView } from '../utils/crowdView';
import { deriveDetailReadView } from '../utils/detailReadView';
import { toDetailErrorView } from '../utils/detailErrorView';
import { CANCEL_RULES, CHANGE_DINING_NOTE } from '../utils/orderDetailTexts';
import { toOrderStatusView } from '../utils/orderStatusView';
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

  const realLoggedOut = source.mode === 'real' && !gate.usable;

  useEffect(() => {
    if (realLoggedOut) {
      return;
    }
    const guard = guardRef.current;
    const token = guard.next();
    setReadState((current) => startInitialRead(current));
    setCrowd(null);
    source.getOrder(orderId).then(
      (data) => {
        if (!guard.isCurrent(token)) {
          return;
        }
        setReadState((current) => settleRead(current, data, new Date()));
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
      },
    );
    return () => {
      guard.reset();
    };
  }, [source, orderId, realLoggedOut, reloadToken]);

  function refreshOrder(): void {
    if (source.mode !== 'real') {
      return;
    }
    const current = stateRef.current;
    if (current.phase !== 'ready' && current.phase !== 'refreshFailed') {
      return;
    }
    const next = startRefresh(current);
    if (next === current) {
      return;
    }
    setReadState(next);
    const guard = guardRef.current;
    const token = guard.next();
    source.getOrder(orderId).then(
      (data) => {
        if (guard.isCurrent(token)) {
          setReadState((state) => settleRead(state, data, new Date()));
        }
      },
      (failure: unknown) => {
        if (!guard.isCurrent(token)) {
          return;
        }
        const error: SourceError = toSourceError(failure);
        setReadState((state) => failRefresh(state, error, classifyRefreshFailure(error)));
      },
    );
  }

  const errorView = toDetailErrorView(readState.error);
  const readView = deriveDetailReadView(readState, source.mode);
  const statusView =
    readState.order !== null ? toOrderStatusView(readState.order, { mode: source.mode }) : null;

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
                onClick={refreshOrder}
              >
                {readView.refreshButtonText}
              </button>
              <p className="student-order-note">
                点击后会重新读取本单最新状态；不会改变订单。
              </p>
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