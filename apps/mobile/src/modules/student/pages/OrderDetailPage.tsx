import { useEffect, useReducer, useRef, useState } from 'react';
import type { CrowdView } from '../utils/crowdView';
import type { OrderStatus, SourceError, StudentOrder, StudentSource } from '../types';
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
import { orderNoText, toOrderStatusView } from '../utils/orderStatusView';
import { deriveDetailReadView } from '../utils/detailReadView';
import { toDetailErrorView } from '../utils/detailErrorView';
import { CANCEL_RULES, CHANGE_DINING_NOTE } from '../utils/orderDetailTexts';
import { deriveCancelAreaView } from '../utils/orderCancelView';
import {
  CANCEL_APPLY_NOTE,
  CANCEL_CONFIRM_TEXT,
  CANCEL_REASON_LABEL,
  CANCEL_REASON_PLACEHOLDER,
  cancelErrorText,
  isCancelAuthCode,
  isCancelConflictCode,
  isCancelRetryableCode,
} from '../utils/cancelTexts';
import {
  initialCancelState,
  reduceCancel,
  validateCancelReason,
} from '../state/orderCancel';
import { createRequestId } from '../../../shared/requestId';
import { derivePollingView } from '../utils/pollingView';
import LoginGuide from '../components/LoginGuide';
import OrderCrowdNote from '../components/OrderCrowdNote';
import StudentTabBar from '../components/StudentTabBar';
import dishChickenLeg from '../assets/dish-chicken-leg.png';
import dishBeefNoodle from '../assets/dish-beef-noodle.png';
import dishZhajiangNoodle from '../assets/dish-zhajiang-noodle.jpg';
import dishChickenColdNoodle from '../assets/dish-chicken-cold-noodle.jpg';
import dishTomatoEgg from '../assets/dish-tomato-egg.jpg';
import friedRice from '../assets/fried-rice.png';
import loginFoodRice from '../assets/login-food-rice.jpg';
import '../order-detail.css';

export interface OrderDetailPageProps {
  source: StudentSource;
  orderId: string;
  onBack: (trigger?: HTMLElement | null) => void;
  backLabel?: string;
  onGoToHome?: (trigger?: HTMLElement | null) => void;
  onGoToShop?: (trigger?: HTMLElement | null) => void;
  onGoToOrders?: (trigger?: HTMLElement | null) => void;
  onGoToProfile?: (trigger?: HTMLElement | null) => void;
  cleanPreview?: boolean;
}

type ReadKind = 'auto' | 'manual';

function dishPhotoFor(name: string): string {
  if (/大黑堡|黑椒|鸡腿|鸡排|堡|鸡/.test(name)) return dishChickenLeg;
  if (/炒饭/.test(name)) return friedRice;
  if (/牛肉面|拉面|汤面/.test(name)) return dishBeefNoodle;
  if (/炸酱|拌面/.test(name)) return dishZhajiangNoodle;
  if (/凉面/.test(name)) return dishChickenColdNoodle;
  if (/番茄/.test(name)) return dishTomatoEgg;
  if (/饭|套餐/.test(name)) return loginFoodRice;
  return dishChickenLeg;
}

function slotClockRange(order: StudentOrder | null, fallback: string): string {
  if (order) {
    const s = /T(\d{2}:\d{2})/.exec(order.slotStart);
    const e = /T(\d{2}:\d{2})/.exec(order.slotEnd);
    if (s && e) {
      return `${s[1]} – ${e[1]}`;
    }
  }
  const cleaned = fallback.replace(/^[^\d]*/, '').replace(/[—-]/g, ' – ');
  return cleaned || '12:00 – 12:30';
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function HeaderRaysSvg() {
  return (
    <svg className="detail-header__rays" viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <path d="M5 14 10 4" stroke="#efb42f" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 17 21 9" stroke="#efb42f" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14 21 25 18" stroke="#efb42f" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function HeaderBrushSvg() {
  return (
    <svg className="detail-header__brush" viewBox="0 0 144 13" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 6.5C42 2.2 98 1.8 140 4.6" stroke="#f2be40" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M26 10.6C66 8.2 106 8.1 138 9.5" stroke="#f2be40" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function HeaderClocheSvg() {
  return (
    <svg className="detail-header__cloche" viewBox="0 0 92 60" fill="none" aria-hidden="true">
      {/* 两侧光泽短线 */}
      <path d="M8 25 13 28M6 33 12 34M13 18 17 22" stroke="#cbb79d" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M83 22 78 26M85 30 79 32M77 16 74 20" stroke="#cbb79d" strokeWidth="1.9" strokeLinecap="round" />
      {/* 顶部提手与圆弧餐盖 */}
      <path d="M41 21C41 16.5 51 16.5 51 21" stroke="#c8b398" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M19 43C19 23.5 73 23.5 73 43" fill="#f3eadc" fillOpacity="0.55" stroke="#c8b398" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M29 37C32 29.5 41 27.5 48 27.5" stroke="#dfd1bd" strokeWidth="2" strokeLinecap="round" />
      {/* 双层底座托盘 */}
      <path d="M14 43.5C34 42 58 42 78 43.5" stroke="#c8b398" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 48.5C34 47.2 58 47.2 80 48.5" stroke="#c8b398" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14 43.5C12 45.2 12 47 14 48.5M78 43.5C80 45.2 80 47 78 48.5" stroke="#c8b398" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShopStoreIcon() {
  return (
    <svg className="detail-shop-row__icon" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11.5 6.2 5.5h15.6L24 11.5" />
      <path d="M4 11.5a3.3 3.3 0 0 0 6.6 0 3.4 3.4 0 0 0 6.8 0 3.3 3.3 0 0 0 6.6 0" />
      <path d="M6.2 14.3V22a1.5 1.5 0 0 0 1.5 1.5h12.6a1.5 1.5 0 0 0 1.5-1.5v-7.7" />
      <path d="M11.5 23.5v-5.2h5v5.2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </svg>
  );
}

function StatusBadgeIcon({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m9.5 9.5 5 5m0-5-5 5" />
      </svg>
    );
  }
  if (status === 'NEW' || status === 'ACCEPTED' || status === 'PREPARING') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v4.8l3.2 1.9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.3 12.2 2.5 2.5 5-5.2" />
    </svg>
  );
}

function CodeRaysLeftSvg() {
  return (
    <svg className="detail-code-hero__rays" viewBox="0 0 24 28" fill="none" aria-hidden="true">
      <path d="M18 7 8 3" stroke="#f1c14b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 14 5 13" stroke="#f1c14b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 21 8 24" stroke="#f1c14b" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CodeRaysRightSvg() {
  return (
    <svg className="detail-code-hero__rays" viewBox="0 0 24 28" fill="none" aria-hidden="true">
      <path d="M6 7 16 3" stroke="#f1c14b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 14 19 13" stroke="#f1c14b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M6 21 16 24" stroke="#f1c14b" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CodeUnderlineSvg() {
  return (
    <svg className="detail-code-hero__underline" viewBox="0 0 240 9" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 5.5C72 2.6 168 2.6 236 5.2" stroke="#f2c44f" strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  );
}

function StepCheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8.2 3 3 6-6.4" />
    </svg>
  );
}

function CalendarSlotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.4" />
      <path d="M8 3.2v3.4M16 3.2v3.4M3.5 10h17" />
    </svg>
  );
}

function TotalBrushSvg() {
  return (
    <svg className="detail-total-row__brush" viewBox="0 0 120 11" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 5.8C40 2.5 82 2.2 117 4.2" stroke="#f2c249" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 9.2C56 7.4 90 7.2 114 8.2" stroke="#f2c249" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function RefreshCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.3-4.8L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.8L20 16" />
      <path d="M20 20v-4h-4" />
    </svg>
  );
}

function ChatBubbleDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 11.5c0 4.4-3.8 8-8.5 8-1.3 0-2.6-.3-3.7-.8L4 20l1.4-3.7A7.6 7.6 0 0 1 3.5 11.5c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8Z" />
      <circle cx="8.8" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
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
  cleanPreview = false,
}: OrderDetailPageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [readState, setReadState] = useState<DetailReadState>(() => initialDetailRead());
  const [crowd, setCrowd] = useState<CrowdView | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cancelState, dispatchCancel] = useReducer(reduceCancel, initialCancelState());
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelNotice, setCancelNotice] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [toastText, setToastText] = useState('');

  const guardRef = useRef(createReadGuard());
  const stateRef = useRef<DetailReadState>(readState);
  stateRef.current = readState;
  const inFlightRef = useRef<{ kind: ReadKind; token: number } | null>(null);
  const runReadRef = useRef<(kind: ReadKind) => void>(() => {
    return;
  });
  const toastTimerRef = useRef<number | null>(null);

  function showToast(text: string): void {
    setToastText(text);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText('');
      toastTimerRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    setCancelNotice('');
    setCancelError('');
    setCancelReason('');
    setContactOpen(false);
    dispatchCancel({ type: 'reset' });
  }, [orderId]);

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
      showToast('状态已刷新');
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
        window.setTimeout(() => {
          source.getOrder(orderId).then(
            (data) => {
              setReadState((current) => settleRead(current, data, new Date()));
              if (kind === 'manual') {
                showToast('订单状态已是最新');
              }
            },
            (failure: unknown) => {
              const err = toSourceError(failure);
              setReadState((current) => failRefresh(current, err, classifyRefreshFailure(err)));
            },
          );
        }, 280);
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
  const cancelView =
    readState.order !== null ? deriveCancelAreaView(readState.order, { mode: source.mode }) : null;
  const cancelSubmitting = cancelState.phase === 'submitting';
  const cancelModalOpen =
    cancelState.phase === 'confirming' ||
    cancelState.phase === 'submitting' ||
    cancelState.phase === 'retry-pending' ||
    cancelState.phase === 'blocked-auth' ||
    cancelState.phase === 'failed';

  function openCancelDialog(): void {
    setContactOpen(false);
    setCancelReason('');
    setCancelError('');
    setCancelNotice('');
    dispatchCancel({ type: 'open-confirm' });
  }

  function closeCancelDialog(): void {
    if (cancelSubmitting) {
      return;
    }
    setCancelError('');
    dispatchCancel({ type: 'cancel-confirm' });
  }

  async function submitCancel(): Promise<void> {
    const order = readState.order;
    if (order === null || cancelView === null || cancelSubmitting) {
      return;
    }
    const trimmedReason = cancelReason.trim();
    if (cancelView.reasonRequired || trimmedReason !== '') {
      const check = validateCancelReason(cancelReason);
      if (!check.ok) {
        setCancelError(check.message);
        return;
      }
    }
    setCancelError('');
    const requestId =
      cancelState.requestId ??
      createRequestId(source.mode === 'real' ? 'stu-cancel' : 'demo-cancel');

    dispatchCancel({ type: 'submit', requestId });
    try {
      const updated = await source.cancelOrder(order.id, {
        requestId,
        expectedVersion: order.version,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      setReadState((current) => settleRead(current, updated, new Date()));
      pollingRef.current.notifyManualSuccess(updated);
      dispatchCancel({ type: 'succeed' });
      setCancelNotice(
        updated.status === 'CANCELLED'
          ? '订单已取消，模拟退款结果以服务端返回为准。'
          : '取消申请已提交，等待档口处理；申请中不代表订单已取消。',
      );
    } catch (failure) {
      const error = toSourceError(failure);
      const text = cancelErrorText(error.code);
      setCancelError(text);
      if (isCancelAuthCode(error.code)) {
        dispatchCancel({ type: 'auth-fail' });
        return;
      }
      if (isCancelConflictCode(error.code)) {
        setCancelError('');
        setCancelNotice(text);
        dispatchCancel({ type: 'conflict' });
        runRead('manual');
        return;
      }
      if (isCancelRetryableCode(error.code) || error.retryable) {
        dispatchCancel({ type: 'retryable-fail' });
        return;
      }
      dispatchCancel({ type: 'terminal-fail', message: text });
    }
  }

  async function handleCopyOrderNo(value: string): Promise<void> {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      showToast('已复制订单编号');
    } catch {
      showToast(`订单编号：${value}`);
    }
  }

  if (realLoggedOut) {
    return (
      <main className="student-order-detail" aria-labelledby="student-order-title">
        <header className="detail-header">
          <div className="detail-header__left">
            <button type="button" className="detail-header__back" onClick={(event) => onBack(event.currentTarget)} aria-label={backLabel}>
              <ChevronLeftIcon />
            </button>
            <div className="detail-header__title-wrap">
              <h1 id="student-order-title" className="detail-header__title">订单详情</h1>
              <HeaderRaysSvg />
              <HeaderBrushSvg />
            </div>
          </div>
          <HeaderClocheSvg />
        </header>
        <div className="detail-main">
          <LoginGuide gate={gate} onRecheck={refresh} onBack={() => onBack()} />
        </div>
        <StudentTabBar
          active="orders"
          placement="fixed"
          onSelect={(tab, button) => {
            if (tab === 'home') {
              (onGoToHome || onGoToShop || onBack)(button);
            } else if (tab === 'order') {
              (onGoToShop || onBack)(button);
            } else if (tab === 'orders') {
              (onGoToOrders || onBack)(button);
            } else if (tab === 'profile') {
              (onGoToProfile || onBack)(button);
            }
          }}
          onReselectActive={(button) => {
            (onGoToOrders || onBack)(button);
          }}
        />
      </main>
    );
  }

  const order = readState.order;
  const displayOrderNo = order ? orderNoText(order) : orderId;
  const shopName = statusView?.shop.text || '食堂档口';
  const stepNodes = statusView?.steps ?? [
    { name: '已下单', reached: true, current: false },
    { name: '已接单', reached: true, current: false },
    { name: '制作中', reached: true, current: false },
    { name: '可取餐', reached: true, current: true },
    { name: '已完成', reached: false, current: false },
  ];
  const activeStepIndex =
    statusView && statusView.activeIndex >= 0 ? statusView.activeIndex : 0;
  const progressRatio =
    statusView && statusView.status === 'CANCELLED'
      ? 0
      : Math.min(1, Math.max(0, activeStepIndex / Math.max(1, stepNodes.length - 1)));

  const rawCode =
    order && (order.status === 'READY' || order.status === 'COMPLETED') && order.pickupCode
      ? order.pickupCode.replace(/\s+/g, '').trim()
      : '';
  const codeHint =
    order?.status === 'READY'
      ? '向档口出示取餐码'
      : order?.status === 'COMPLETED'
        ? '已完成取餐核销'
        : order?.status === 'CANCELLED'
          ? '订单已取消，无取餐码'
          : '可取餐后显示取餐码';
  const codeFallbackText =
    order?.status === 'CANCELLED'
      ? '订单已取消'
      : order?.status === 'COMPLETED'
        ? '已完成取餐'
        : '制作完成后生成';

  const slotText = slotClockRange(order, statusView?.timeRangeShort ?? '');

  return (
    <main className="student-order-detail" aria-labelledby="student-order-title">
      {/* 1. 顶部手绘感标题栏 */}
      <header className="detail-header">
        <div className="detail-header__left">
          <button type="button" className="detail-header__back" onClick={(event) => onBack(event.currentTarget)} aria-label={backLabel}>
            <ChevronLeftIcon />
          </button>
          <div className="detail-header__title-wrap">
            <h1 id="student-order-title" className="detail-header__title">订单详情</h1>
            <HeaderRaysSvg />
            <HeaderBrushSvg />
          </div>
        </div>
        <HeaderClocheSvg />
      </header>

      <div className="detail-main">
        {/* 错误状态 */}
        {readState.phase === 'error' && errorView && errorView.action !== 'login' ? (
          <div className="detail-state-card detail-state-card--error" role="alert">
            <p>{errorView.message}</p>
            <button
              type="button"
              onClick={(event) =>
                errorView.action === 'back-to-menu'
                  ? onBack(event.currentTarget)
                  : setReloadToken((value) => value + 1)
              }
            >
              {errorView.action === 'back-to-menu' ? '返回' : errorView.actionLabel}
            </button>
          </div>
        ) : null}

        {/* 读取中状态 */}
        {readState.phase === 'reading' ? (
          <div className="detail-state-card" role="status">正在读取订单信息…</div>
        ) : null}

        {/* 2. 主票据卡片 */}
        {statusView ? (
          <>
            <article className="detail-receipt" aria-label="订单详情小票">
              <div className="detail-receipt__top-stub">
                {/* 2A. 档口与订单编号 + 右侧状态和纸胶带 */}
                <div className="detail-shop-row">
                  <div className="detail-shop-row__info">
                    <ShopStoreIcon />
                    <div className="detail-shop-row__text">
                      <h2 className="detail-shop-row__name">{shopName}</h2>
                      <p className="detail-shop-row__no">
                        <span className="detail-shop-row__no-val">订单编号: {displayOrderNo}</span>
                        <button
                          type="button"
                          className="detail-copy-btn"
                          aria-label="复制订单编号"
                          onClick={() => {
                            void handleCopyOrderNo(displayOrderNo);
                          }}
                        >
                          <CopyIcon />
                        </button>
                      </p>
                    </div>
                  </div>
                  <span className="detail-shop-row__sep" aria-hidden="true" />
                  <div className="detail-status-tape-wrap">
                    <span
                      className={`detail-status-tape${
                        statusView.status === 'CANCELLED' ? ' detail-status-tape--cancelled' : ''
                      }`}
                    >
                      <StatusBadgeIcon status={statusView.status} />
                      <span>{statusView.statusLabel}</span>
                    </span>
                  </div>
                </div>

                {/* 首条撕票分割虚线（两侧由真实遮罩裁切半圆凹孔） */}
                <div className="detail-divider detail-divider--notched" aria-hidden="true" />
              </div>

              <div className="detail-receipt__body">
                {/* 2B. 取餐码展示区 */}
              <section className="detail-code-section" aria-label="取餐码">
                <div className="detail-code-section__top">
                  <span className="detail-brush-tag">取餐码</span>
                  <span className="detail-code-section__hint">{codeHint}</span>
                </div>
                <div className="detail-code-hero">
                  <CodeRaysLeftSvg />
                  <div className="detail-code-hero__center">
                    {rawCode ? (
                      <div className="detail-code-hero__digits" aria-label={`取餐码 ${rawCode}`}>
                        {rawCode.split('').map((ch, idx) => (
                          <span key={`${idx}-${ch}`}>{ch}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="detail-code-hero__placeholder">{codeFallbackText}</div>
                    )}
                    <CodeUnderlineSvg />
                  </div>
                  <CodeRaysRightSvg />
                </div>

                {statusView.cancelRequestPending ? (
                  <div className="detail-cancel-banner" role="status">
                    取消申请待处理（{statusView.cancelRequestTimeText}）· 原因：{statusView.cancelRequestReason} · 申请中不代表订单已取消
                  </div>
                ) : null}
                {statusView.status === 'CANCELLED' && statusView.cancelText ? (
                  <div className="detail-cancel-banner" role="status">
                    {statusView.cancelText} · {statusView.paymentText}
                  </div>
                ) : null}
              </section>

              <div className="detail-divider" aria-hidden="true" />

              {/* 2C. 五步进度条 */}
              <div className="detail-steps" aria-label="订单进度">
                <span className="detail-steps__track-bg" aria-hidden="true" />
                <span
                  className="detail-steps__track-fill"
                  style={{ width: `calc(80% * ${progressRatio})` }}
                  aria-hidden="true"
                />
                {stepNodes.map((step) => (
                  <div
                    key={step.name}
                    className={`detail-step${step.reached ? ' is-reached' : ''}${
                      step.current ? ' is-current' : ''
                    }`}
                  >
                    <span className="detail-step__dot">
                      {step.reached ? <StepCheckIcon /> : null}
                    </span>
                    <span className="detail-step__label">{step.name}</span>
                  </div>
                ))}
              </div>

              <div className="detail-divider" aria-hidden="true" />

              {/* 2D. 取餐时段与用餐方式 */}
              <div className="detail-slot-row">
                <div className="detail-slot-row__left">
                  <CalendarSlotIcon />
                  <span className="detail-slot-row__label">取餐时段</span>
                  <strong className="detail-slot-row__time">{slotText}</strong>
                </div>
                <div className="detail-slot-row__right">
                  <span className="detail-slot-row__sep" aria-hidden="true" />
                  <span className="detail-dining-pill">{statusView.diningModeText || '堂食'}</span>
                </div>
              </div>

              <div className="detail-divider" aria-hidden="true" />

              {/* 2E. 订单明细 */}
              <section className="detail-items-section" aria-label="订单明细">
                <div>
                  <span className="detail-brush-tag">订单明细</span>
                </div>
                <div className="detail-items-list">
                  {statusView.items.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="detail-item">
                      <div className="detail-item__photo-wrap">
                        <span className="detail-item__tape" aria-hidden="true" />
                        <img
                          className="detail-item__photo"
                          src={dishPhotoFor(item.name)}
                          alt={item.name}
                        />
                      </div>
                      <div className="detail-item__info">
                        <h3 className="detail-item__name">
                          {item.name} × {item.quantity}
                        </h3>
                        {item.customizationText ? (
                          <p className="detail-item__custom">{item.customizationText}</p>
                        ) : null}
                        <p className="detail-item__unit">单价 {item.unitPriceText}</p>
                      </div>
                      <strong className="detail-item__subtotal">{item.subtotalText}</strong>
                    </div>
                  ))}
                </div>
                {statusView.remark ? (
                  <p className="detail-receipt-meta">订单备注：{statusView.remark}</p>
                ) : null}
                {statusView.delayText ? (
                  <p className="detail-receipt-meta detail-receipt-meta--warn">{statusView.delayText}</p>
                ) : null}
              </section>

              <div className="detail-divider" aria-hidden="true" />

              {/* 2F. 订单合计 */}
              <div className="detail-total-row">
                <span className="detail-total-row__label">订单合计</span>
                <div className="detail-total-row__amount-wrap">
                  <strong className="detail-total-row__amount">{statusView.totalText}</strong>
                  <TotalBrushSvg />
                </div>
              </div>
              </div>
            </article>

            {/* 刷新或取消反馈提示 */}
            {cancelNotice || readView.refreshNoticeText ? (
              <div className="detail-feedback-banner" role="status">
                {cancelNotice || readView.refreshNoticeText}
              </div>
            ) : null}

            {/* 3. 双操作主按钮：刷新状态 & 联系档口 */}
            <div className="detail-actions">
              <button
                type="button"
                className="detail-btn detail-btn--refresh"
                disabled={readState.phase === 'refreshing'}
                onClick={() => runRead('manual')}
              >
                <RefreshCircleIcon />
                <span>{readState.phase === 'refreshing' ? '正在刷新…' : '刷新状态'}</span>
              </button>
              <button
                type="button"
                className="detail-btn detail-btn--contact"
                onClick={() => setContactOpen(true)}
              >
                <ChatBubbleDotsIcon />
                <span>联系档口</span>
              </button>
            </div>

            {/* 非预览极简模式且非可取餐态时，提供直观的辅助状态与取消快捷入口 */}
            {!cleanPreview &&
            statusView.status !== 'READY' &&
            cancelView?.actionLabel &&
            cancelView.actionEnabled ? (
              <div className="detail-subbar">
                <span>{source.mode === 'sample' ? '示例订单 · 模拟已付款' : '模拟已付款 · 不发生真实资金交易'}</span>
                <button
                  type="button"
                  className="detail-subbar__link"
                  disabled={cancelSubmitting}
                  onClick={openCancelDialog}
                >
                  {cancelView.actionLabel}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* 轻提示 Toast */}
      {toastText ? (
        <div className="detail-toast" role="status">
          {toastText}
        </div>
      ) : null}

      {/* 4. 底部导航栏 */}
      <StudentTabBar
        active="orders"
        placement="fixed"
        onSelect={(tab, button) => {
          if (tab === 'home') {
            (onGoToHome || onGoToShop || onBack)(button);
          } else if (tab === 'order') {
            (onGoToShop || onBack)(button);
          } else if (tab === 'orders') {
            (onGoToOrders || onBack)(button);
          } else if (tab === 'profile') {
            (onGoToProfile || onBack)(button);
          }
        }}
        onReselectActive={(button) => {
          (onGoToOrders || onBack)(button);
        }}
      />

      {/* 5A. 联系档口与订单服务弹窗 */}
      {contactOpen && statusView ? (
        <div className="detail-modal-backdrop" onClick={() => setContactOpen(false)}>
          <div
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-contact-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="detail-modal__head">
              <h3 id="detail-contact-modal-title" className="detail-modal__title">联系档口与订单说明</h3>
              <button
                type="button"
                className="detail-modal__close"
                aria-label="关闭"
                onClick={() => setContactOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="detail-modal__body">
              <div className="detail-modal__kv">
                <span>就餐档口</span>
                <strong>{shopName}</strong>
              </div>
              <div className="detail-modal__kv">
                <span>订单编号</span>
                <strong>{displayOrderNo}</strong>
              </div>
              <p style={{ margin: '2px 0' }}>
                请凭订单编号前往 <strong>{shopName}</strong> 窗口咨询。{CHANGE_DINING_NOTE}
              </p>
              <p style={{ margin: 0 }}>{statusView.paymentText}</p>
              {pollingView.showText ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#826e5b' }}>{pollingView.text}</p>
              ) : null}
              <div className="detail-modal__rules">
                {CANCEL_RULES.map((rule) => (
                  <p key={rule}>• {rule}</p>
                ))}
              </div>
              <OrderCrowdNote crowd={crowd} />
            </div>
            <div className="detail-modal__actions">
              {statusView.canShowCancelAction ? (
                cancelView?.actionLabel && cancelView.actionEnabled ? (
                  <button
                    type="button"
                    className="detail-modal__btn-secondary"
                    disabled={cancelSubmitting}
                    onClick={openCancelDialog}
                  >
                    {cancelView.actionLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="detail-modal__btn-secondary"
                    onClick={() => {
                      void handleCopyOrderNo(displayOrderNo);
                    }}
                  >
                    复制单号
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="detail-modal__btn-secondary"
                  onClick={() => {
                    void handleCopyOrderNo(displayOrderNo);
                  }}
                >
                  复制单号
                </button>
              )}
              <button
                type="button"
                className="detail-modal__btn-primary"
                onClick={() => setContactOpen(false)}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 5B. 取消订单 / 申请取消弹窗 */}
      {cancelModalOpen && cancelView ? (
        <div className="detail-modal-backdrop" onClick={closeCancelDialog}>
          <div
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-cancel-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="detail-modal__head">
              <h3 id="order-cancel-modal-title" className="detail-modal__title">
                {cancelView.reasonRequired ? '申请取消订单' : '确认取消订单'}
              </h3>
              <button
                type="button"
                className="detail-modal__close"
                onClick={closeCancelDialog}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="detail-modal__body">
              <p style={{ margin: 0 }}>
                {cancelView.reasonRequired ? CANCEL_APPLY_NOTE : CANCEL_CONFIRM_TEXT}
              </p>
              <label className="detail-modal__field">
                <span>
                  {CANCEL_REASON_LABEL}
                  {cancelView.reasonRequired ? '（必填）' : '（选填）'}
                </span>
                <textarea
                  value={cancelReason}
                  maxLength={200}
                  rows={3}
                  placeholder={CANCEL_REASON_PLACEHOLDER}
                  disabled={cancelSubmitting}
                  onChange={(event) => {
                    setCancelReason(event.target.value);
                    setCancelError('');
                  }}
                />
              </label>
              {source.mode === 'sample' ? (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9a6412' }}>
                  样例模式下只在本地模拟，不会调用服务端。
                </p>
              ) : null}
              {cancelError || cancelState.message ? (
                <p className="detail-modal__error" role="alert">
                  {cancelError || cancelState.message}
                </p>
              ) : null}
            </div>
            <div className="detail-modal__actions">
              <button
                type="button"
                className="detail-modal__btn-secondary"
                onClick={closeCancelDialog}
                disabled={cancelSubmitting}
              >
                暂不取消
              </button>
              <button
                type="button"
                className="detail-modal__btn-primary"
                onClick={() => {
                  void submitCancel();
                }}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? '正在提交…' : cancelView.reasonRequired ? '提交申请' : '确认取消'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
