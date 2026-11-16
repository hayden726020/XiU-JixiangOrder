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
import DemoModeNotice from '../components/DemoModeNotice';
import LoginGuide from '../components/LoginGuide';
import OrderCrowdNote from '../components/OrderCrowdNote';
import SampleBanner from '../components/SampleBanner';
import detailDishChicken from '../assets/detail-dish-chicken.png';
import dishChickenRice from '../assets/dish-chicken-rice.png';
import '../order-detail.css';
import '../order-list.css';

export interface OrderDetailPageProps {
  source: StudentSource;
  orderId: string;
  onBack: () => void;
  backLabel?: string;
  onGoToHome?: () => void;
  onGoToShop?: () => void;
  onGoToOrders?: () => void;
  onGoToProfile?: () => void;
}

type ReadKind = 'auto' | 'manual';

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

function ForkKnifeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
      <path d="M15 11v11" />
      <path d="M5 2v8a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V2" />
      <path d="M8 13v9" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg className="order-dish-polaroid__clip" viewBox="0 0 24 48" fill="none" stroke="#64748b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4 C6 4, 3 8, 3 16 L3 36 C3 42, 7 46, 12 46 C17 46, 21 42, 21 36 L21 12 C21 7, 18 4, 13 4 C8 4, 6 7, 6 12 L6 34 C6 37, 8 40, 12 40 C16 40, 18 37, 18 34 L18 14" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="order-cancel-note__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export default function OrderDetailPage({
  source,
  orderId,
  onBack,
  backLabel = '返回订单列表',
  onGoToHome,
  onGoToShop,
  onGoToOrders,
  onGoToProfile,
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
      if (source.mode === 'sample') {
        setReadState((state) => startRefresh(state));
        setTimeout(() => {
          source.getOrder(orderId).then((data) => {
            setReadState((current) => settleRead(current, data, new Date()));
          });
        }, 350);
      }
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

  if (realLoggedOut) {
    return (
      <main className="student-order-detail" aria-labelledby="student-order-title">
        <nav className="order-nav">
          <button type="button" className="order-nav__back" onClick={onBack} aria-label={backLabel}>
            <ChevronLeftIcon />
          </button>
          <h1 id="student-order-title" className="order-nav__title">订单详情</h1>
          <div className="order-nav__placeholder" />
        </nav>
        <div style={{ padding: '1rem' }}>
          <LoginGuide gate={gate} onRecheck={refresh} onBack={onBack} />
        </div>
      </main>
    );
  }

  // 节点高亮步数与线段宽度比例
  const isReadyMode = statusView?.status === 'READY';
  const stepNodes = statusView?.steps ?? [
    { name: '已下单', reached: true, current: false },
    { name: '已接单', reached: true, current: false },
    { name: '制作中', reached: true, current: false },
    { name: '可取餐', reached: true, current: true },
    { name: '已完成', reached: false, current: false },
  ];
  const activeStepIndex = statusView ? Math.max(0, statusView.activeIndex) : 3;
  const lineProgressPercent = Math.min(100, Math.max(0, (activeStepIndex / (stepNodes.length - 1)) * 100));

  // 首个菜品信息与价格
  const primaryItem = statusView?.items?.[0] ?? {
    name: '黑椒鸡腿饭',
    quantity: 1,
    unitPriceText: '¥14',
    subtotalText: '¥14',
  };

  // 取餐时段简写
  const rawRange = statusView?.timeRangeShort || '今天 12:00—12:30';
  const timeOnly = rawRange.replace(/^[^\d]*/, '') || '12:00—12:30';

  // 取餐码展示（若有空格则直接展示，否则格式化为带间距字符）
  const pickupCodeRaw = statusView?.pickupCodeText || 'A 268';
  const pickupCodeDisplay = pickupCodeRaw.replace(/\s+/g, ' ').trim();

  return (
    <main className="student-order-detail" aria-labelledby="student-order-title">
      {/* 顶部指示条 */}
      {source.mode === 'sample' ? <SampleBanner /> : null}

      {/* 顶部导航栏 */}
      <nav className="order-nav">
        <button type="button" className="order-nav__back" onClick={onBack} aria-label={backLabel}>
          <ChevronLeftIcon />
        </button>
        <h1 id="student-order-title" className="order-nav__title">订单详情</h1>
        <div className="order-nav__placeholder" />
      </nav>

      {/* 错误提示 */}
      {readState.phase === 'error' && errorView && errorView.action !== 'login' ? (
        <div className="student-error" role="alert" style={{ margin: '1rem' }}>
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
              {errorView.action === 'back-to-menu' ? '返回' : errorView.actionLabel}
            </button>
          </div>
        </div>
      ) : null}

      {/* 加载状态 */}
      {readState.phase === 'reading' ? (
        <p className="student-loading" style={{ textAlign: 'center', padding: '2rem' }}>正在读取订单信息…</p>
      ) : null}

      {/* 正常内容区 */}
      {statusView ? (
        <div className="order-detail-content">
          {/* 1. 顶部横幅：可取餐状态下对齐参考图 “做好啦，来取餐吧！” */}
          {isReadyMode ? (
            <section className="order-ready-banner" aria-label="取餐通知">
              <div className="order-ready-banner__title-wrap">
                <h2 className="order-ready-banner__title">做好啦，来取餐吧！</h2>
                <span className="order-ready-banner__sparkle" aria-hidden="true">✨</span>
              </div>
              <p className="order-ready-banner__sub">{statusView.dishShopTag} · 可取餐</p>
            </section>
          ) : (
            <section className="order-status-card" aria-label="订单进度与状态">
              <div className="order-status-card__header">
                <div className="order-status-card__title-wrap">
                  <h2 className="order-status-card__title">{statusView.statusLabel}</h2>
                  <span className="order-status-card__sparkles" aria-hidden="true">✨</span>
                </div>
                {statusView.cancelRequestPending ? (
                  <div className="order-status-card__tape-tag" role="status">
                    取消申请待处理
                  </div>
                ) : null}
              </div>

              {statusView.cancelRequestPending ? (
                <>
                  <p className="order-status-card__lead">已提交申请，等待档口确认</p>
                  <p className="order-status-card__sublead">申请中不代表订单已取消</p>
                </>
              ) : (
                <>
                  <p className="order-status-card__lead">档口正在用心为您烹制</p>
                  <p className="order-status-card__sublead">
                    {statusView.status === 'CANCELLED' ? statusView.cancelText : '请留意取餐通知与时段'}
                  </p>
                </>
              )}
            </section>
          )}

          {/* 2. 横向五步进度条 */}
          <div className="order-steps-bar" aria-label="五步进度" style={{ background: '#ffffff', borderRadius: '16px', padding: '1.1rem 0.6rem 0.9rem', boxShadow: '0 4px 14px rgba(7, 22, 56, 0.05)' }}>
            <div className="order-steps-bar__line-bg" aria-hidden="true" style={{ top: '1.65rem' }} />
            <div
              className="order-steps-bar__line-active"
              style={{ width: `calc(${lineProgressPercent}% * 0.78)`, top: '1.65rem' }}
              aria-hidden="true"
            />
            {stepNodes.map((step) => (
              <div
                key={step.name}
                className={`order-step-node${step.reached ? ' is-reached' : ''}${
                  step.current ? ' is-current' : ''
                }`}
              >
                <div className="order-step-node__circle">
                  {step.reached ? <CheckIcon /> : null}
                </div>
                <span className="order-step-node__name">{step.name}</span>
              </div>
            ))}
          </div>

          {/* 3. 核心卡片：在可取餐时高保真渲染票券式超大取餐码；在其他状态下渲染拍立得菜品/取消申请 */}
          {isReadyMode ? (
            <section className="pickup-ticket-card" aria-label="取餐码凭证">
              {/* 顶部黄色纸胶带 */}
              <div className="pickup-ticket-card__tape" aria-hidden="true" />
              {/* 左右票根凹孔 */}
              <div className="pickup-ticket-card__notch-left" aria-hidden="true" />
              <div className="pickup-ticket-card__notch-right" aria-hidden="true" />

              {/* 标题与手绘装饰线 */}
              <div className="pickup-ticket-card__title-box">
                <span className="pickup-ticket-card__ray" aria-hidden="true">///</span>
                <h3 className="pickup-ticket-card__title">取餐码</h3>
                <span className="pickup-ticket-card__ray" aria-hidden="true">\\\</span>
              </div>

              {/* 超大字号取餐码 */}
              <div className="pickup-ticket-card__code">
                {(pickupCodeDisplay.replace(/\s+/g, '') || 'A268').split('').map((char, idx) => (
                  <span key={idx}>{char}</span>
                ))}
              </div>

              <p className="pickup-ticket-card__hint">向档口出示取餐码</p>
              <p className="pickup-ticket-card__subhint">示例取餐码 · 不可核销</p>

              {/* 水平虚线撕拉线 */}
              <div className="pickup-ticket-card__divider" aria-hidden="true" />

              {/* 票券底部时段与用餐方式 */}
              <div className="pickup-ticket-card__footer">
                <ForkKnifeIcon />
                <span>{timeOnly}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span className="pickup-ticket-card__dining-tag">
                  {statusView.diningModeText}
                </span>
              </div>
            </section>
          ) : (
            <>
              {/* 非可取餐状态：拍立得回形针卡片 */}
              <section className="order-dish-polaroid" aria-label="订单商品明细">
                <PaperclipIcon />
                <div className="order-dish-polaroid__photo-frame">
                  <img src={dishChickenRice} alt={primaryItem.name} />
                </div>
                <div className="order-dish-polaroid__info">
                  <h3 className="order-dish-polaroid__title">
                    {primaryItem.name} {primaryItem.quantity > 0 ? `×${primaryItem.quantity}` : ''}
                  </h3>
                  <span className="order-dish-polaroid__tag">{statusView.dishShopTag}</span>
                  <div className="order-dish-polaroid__price-row">
                    <span className="order-dish-polaroid__price">{primaryItem.unitPriceText}</span>
                  </div>
                  <p className="order-dish-polaroid__slot">
                    {statusView.timeRangeShort} · {statusView.diningModeText}
                  </p>
                </div>
              </section>

              {statusView.cancelRequestPending ? (
                <section className="order-cancel-note" aria-label="取消申请信息">
                  <div className="order-cancel-note__header">
                    <h3 className="order-cancel-note__title">取消申请</h3>
                    <span className="order-cancel-note__time">{statusView.cancelRequestTimeText}</span>
                  </div>
                  <div className="order-cancel-note__body">
                    <ClockIcon />
                    <p className="order-cancel-note__reason">
                      申请原因：{statusView.cancelRequestReason}
                    </p>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {/* 4. 菜品信息小卡片（带黄色手绘波浪下划线） */}
          <section className="order-dish-mini-card" aria-label="商品信息">
            <img className="order-dish-mini-card__thumb" src={detailDishChicken} alt={primaryItem.name} />
            <div className="order-dish-mini-card__info">
              <div className="order-dish-mini-card__row">
                <h4 className="order-dish-mini-card__name">
                  {primaryItem.name} {primaryItem.quantity > 0 ? `×${primaryItem.quantity}` : ''}
                </h4>
                <span className="order-dish-mini-card__price">{primaryItem.unitPriceText}</span>
              </div>
              <p className="order-dish-mini-card__sim-note">模拟付款，不发生资金交易</p>
            </div>
          </section>

          {/* 5. 提示文案 */}
          <p className="order-change-dining-hint">
            如需更改堂食或外带，请联系档口
          </p>

          {/* 6. 双按钮操作栏 */}
          <div className="order-actions-dual-row">
            <button
              type="button"
              className="order-btn-refresh-main"
              disabled={readState.phase === 'refreshing'}
              onClick={() => runRead('manual')}
            >
              <RefreshIcon />
              <span>{readState.phase === 'refreshing' ? '正在刷新…' : '刷新订单'}</span>
            </button>
            <button
              type="button"
              className="order-btn-cancel-sub"
              onClick={() => {
                alert('已接单或制作中的订单，如需取消请联系档口处理。');
              }}
            >
              申请取消
            </button>
          </div>

          {/* 7. 折叠辅助信息与只读技术抽屉 */}
          <details className="order-extra-details">
            <summary>查看订单详情与技术信息 ▾</summary>
            <div className="order-extra-details__body">
              <div className="order-extra-row">
                <span>订单编号：</span>
                <code>{statusView.orderId}</code>
              </div>
              <div className="order-extra-row">
                <span>就餐档口：</span>
                <span>{statusView.shop.text}</span>
              </div>
              <div className="order-extra-row">
                <span>创建时间：</span>
                <span>{statusView.createdText || '未知'}</span>
              </div>
              <div className="order-extra-row">
                <span>时段范围：</span>
                <span>{statusView.slotRangeText}</span>
              </div>
              {statusView.delayText ? (
                <p style={{ color: '#d97706', margin: '0.2rem 0' }}>{statusView.delayText}</p>
              ) : null}
              {pollingView.showText ? (
                <p style={{ margin: '0.2rem 0', color: '#64748b' }}>{pollingView.text}</p>
              ) : null}
              {readView.refreshNoticeText ? (
                <p style={{ margin: '0.2rem 0', color: '#e11d48' }}>{readView.refreshNoticeText}</p>
              ) : null}
              <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem' }}>
                <p style={{ fontWeight: 700, margin: '0 0 0.2rem' }}>取消与变更规则：</p>
                {CANCEL_RULES.map((rule) => (
                  <p key={rule} style={{ margin: '0.15rem 0' }}>• {rule}</p>
                ))}
                <p style={{ margin: '0.15rem 0' }}>• {CHANGE_DINING_NOTE}</p>
              </div>
              <OrderCrowdNote crowd={crowd} />
            </div>
          </details>

          {source.mode === 'sample' ? <DemoModeNotice /> : null}
        </div>
      ) : null}

      {/* 底部 TabBar（全局导航条） */}
      <nav className="student-tabbar" aria-label="底部导航">
        <button
          type="button"
          className="student-tab-item"
          onClick={onGoToHome || onGoToShop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>首页</span>
        </button>

        <button
          type="button"
          className="student-tab-item"
          onClick={onGoToShop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          <span>点餐</span>
        </button>

        <button
          type="button"
          className="student-tab-item is-active"
          onClick={onGoToOrders || onBack}
          aria-current="page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>订单</span>
        </button>

        <button
          type="button"
          className="student-tab-item"
          onClick={onGoToProfile}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>我的</span>
        </button>
      </nav>
    </main>
  );
}
