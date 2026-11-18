import { useEffect, useState } from 'react';
import type { StudentOrder, StudentSource } from '../types';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import { clearSession } from '../../../shared/session';
import { clearPresence } from '../../../shared/location';
import SampleBanner from '../components/SampleBanner';
import RealModeNotice from '../components/RealModeNotice';
import studentAvatar from '../assets/student-avatar.png';
import '../profile.css';

export interface ProfilePageProps {
  source: StudentSource;
  onOpenOrders: () => void;
  onOpenOrder?: (id: string) => void;
  onGoToShop: () => void;
  onGoToMenu: () => void;
}

type ModalType = 'location' | 'dining' | 'feedback' | 'settings' | null;

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function CapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M16 12h5" />
      <circle cx="16.5" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ChefHatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </svg>
  );
}

function BagCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7h12l1 13H5L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="m9.5 14 1.8 1.8 3.5-3.6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.8 12.2 2.2 2.2 4.4-4.4" />
    </svg>
  );
}

function BowlBadgeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 17h20a10 10 0 0 1-20 0Z" fill="#f5b335" stroke="#b96d08" strokeWidth="1.6" />
      <path d="M11 27h10" stroke="#b96d08" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 13c0-2 1.5-2.5 1.5-4.5M16 13c0-2 1.5-2.5 1.5-4.5M21 13c0-2 1.5-2.5 1.5-4.5" stroke="#c87b12" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H12v17H4.5A2.5 2.5 0 0 0 2 22V5.5Z" />
      <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H12v17h7.5a2.5 2.5 0 0 1 2.5 2.5V5.5Z" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      <circle cx="9.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="12.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="15.5" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 6.5v5.5c0 5 3.4 9.1 8 10 4.6-.9 8-5 8-10V6.5L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10 9-7 9 7v10H3zM9 21v-7h6v7" />
    </svg>
  );
}

function BowlIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h18a9 9 0 0 1-18 0ZM5 21h14" />
      <path d="M9 8c0-2 2-2 2-4m4 5c0-2 2-2 2-4" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity="0.18" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  );
}

function formatSlotBefore(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '预约时段';
  const hhmm = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${hhmm} 前`;
}

function activeStatusText(order: StudentOrder): string {
  if (order.status === 'READY') return '待取餐';
  if (order.status === 'PREPARING') return '制作中';
  if (order.status === 'ACCEPTED') return '已接单';
  if (order.status === 'NEW') return '待接单';
  return '处理中';
}

function activeSubtitle(order: StudentOrder): string {
  const endText = formatSlotBefore(order.slotEnd);
  if (order.status === 'READY') {
    return `餐品已备好，请于 ${endText}前往取餐`;
  }
  if (order.status === 'PREPARING' || order.status === 'ACCEPTED') {
    return `餐品制作中，预计 ${endText}可取餐`;
  }
  return `已提交订单，预计 ${endText}取餐`;
}

function pickCurrentOrder(orders: StudentOrder[]): StudentOrder | null {
  const priority: Record<StudentOrder['status'], number> = {
    READY: 4,
    PREPARING: 3,
    ACCEPTED: 2,
    NEW: 1,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  const active = orders.filter((o) => priority[o.status] > 0);
  if (active.length === 0) return null;
  return active.sort((a, b) => {
    const diff = priority[b.status] - priority[a.status];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

export default function ProfilePage({
  source,
  onOpenOrders,
  onOpenOrder,
  onGoToShop,
  onGoToMenu,
}: ProfilePageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState('');

  useEffect(() => {
    if (source.mode === 'real' && !gate.usable) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    source.listOrders().then(
      (list) => {
        if (!cancelled) setOrders(list);
      },
      () => {
        if (!cancelled) setOrders([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, gate.usable]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleClearLocation() {
    if (clearing) return;
    setClearing(true);
    try {
      if (source.mode === 'real') {
        await clearPresence();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      showToast('已清除位置判断记录');
    } catch {
      showToast('清除位置记录失败，请稍后重试');
    } finally {
      setClearing(false);
    }
  }

  function handleLogout() {
    clearSession();
    refresh();
    setModal(null);
    showToast('已退出当前账号');
  }

  function handleSubmitFeedback() {
    if (!feedbackDraft.trim()) {
      showToast('请先输入反馈内容');
      return;
    }
    setFeedbackDraft('');
    setModal(null);
    showToast('已记录意见反馈（当前为本地演示提示）');
  }

  const displayName =
    source.mode === 'sample'
      ? '演示学生'
      : gate.usable
        ? gate.identityText
        : '同学，你好';

  const newCount = orders.filter((o) => o.status === 'NEW').length;
  const preparingCount = orders.filter(
    (o) => o.status === 'ACCEPTED' || o.status === 'PREPARING',
  ).length;
  const readyCount = orders.filter((o) => o.status === 'READY').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
  const currentOrder = pickCurrentOrder(orders);

  return (
    <div className="student-profile" aria-labelledby="profile-title">
      {source.mode === 'sample' ? <SampleBanner /> : <RealModeNotice />}

      <header className="profile-topbar">
        <div className="profile-topbar__title-wrap">
          <h1 id="profile-title" className="profile-topbar__title">我的</h1>
          <span className="profile-topbar__underline" aria-hidden="true" />
        </div>
        <button
          type="button"
          className="profile-topbar__gear"
          aria-label="账号与设置"
          onClick={() => setModal('settings')}
        >
          <GearIcon />
        </button>
      </header>

      <main className="profile-content">
        {/* 1. 学生信息拍立得行 */}
        <section className="profile-identity" aria-label="学生个人档案">
          <div className="profile-polaroid">
            <span className="profile-polaroid__tape" aria-hidden="true" />
            <div className="profile-polaroid__photo">
              <img src={studentAvatar} alt="学生卡通头像" />
            </div>
            <span className="profile-polaroid__caption">食麦呼 ♡</span>
          </div>

          <div className="profile-identity__meta">
            <h2 className="profile-identity__name">{displayName}</h2>
            <div className="profile-identity__tags">
              <span className="profile-identity__badge">
                <CapIcon />
                {source.mode === 'sample' || gate.usable ? '已认证学生' : '未登录'}
              </span>
              <span className="profile-identity__divider" aria-hidden="true">|</span>
              <span className="profile-identity__school">西安邮电大学</span>
            </div>
            <p className="profile-identity__motto">好好吃饭，元气满满</p>
          </div>

          <button
            type="button"
            className="profile-identity__chevron"
            aria-label="查看账号信息"
            onClick={() => setModal('settings')}
          >
            <ChevronRightIcon />
          </button>
        </section>

        {/* 2. 我的订单卡片 */}
        <section className="profile-card profile-orders-card" aria-label="我的订单快捷入口">
          <div className="profile-card__head">
            <div className="profile-card__title-group">
              <ClipboardIcon />
              <h2>我的订单</h2>
            </div>
            <button type="button" className="profile-card__more" onClick={onOpenOrders}>
              查看全部 <ChevronRightIcon />
            </button>
          </div>

          <div className="profile-orders-grid">
            <button type="button" className="profile-orders-grid__item" onClick={onOpenOrders}>
              <span className="profile-orders-grid__icon">
                <PendingIcon />
                {newCount > 0 ? <span className="profile-orders-grid__dot">{newCount}</span> : null}
              </span>
              <span>待接单</span>
            </button>

            <button type="button" className="profile-orders-grid__item" onClick={onOpenOrders}>
              <span className="profile-orders-grid__icon">
                <ChefHatIcon />
                {preparingCount > 0 ? <span className="profile-orders-grid__dot">{preparingCount}</span> : null}
              </span>
              <span>制作中</span>
            </button>

            <button type="button" className="profile-orders-grid__item" onClick={onOpenOrders}>
              <span className="profile-orders-grid__icon">
                <BagCheckIcon />
                {readyCount > 0 ? <span className="profile-orders-grid__dot">{readyCount}</span> : null}
              </span>
              <span>待取餐</span>
            </button>

            <button type="button" className="profile-orders-grid__item" onClick={onOpenOrders}>
              <span className="profile-orders-grid__icon">
                <CheckCircleIcon />
                {completedCount > 0 ? <span className="profile-orders-grid__count">{completedCount}</span> : null}
              </span>
              <span>已完成</span>
            </button>
          </div>
        </section>

        {/* 3. 当前订单票券卡 */}
        <section className="profile-ticket" aria-label="当前订单">
          <div className="profile-ticket__head">
            <div className="profile-ticket__title-wrap">
              <h2>当前订单</h2>
              <span className="profile-ticket__underline" aria-hidden="true" />
            </div>
            {currentOrder ? (
              <span className="profile-ticket__tape-badge">{activeStatusText(currentOrder)}</span>
            ) : (
              <span className="profile-ticket__tape-badge is-idle">去点餐</span>
            )}
          </div>

          {currentOrder ? (
            <button
              type="button"
              className="profile-ticket__body"
              onClick={() => (onOpenOrder ? onOpenOrder(currentOrder.id) : onOpenOrders())}
            >
              <div className="profile-ticket__shop-row">
                <span className="profile-ticket__bowl">
                  <BowlBadgeIcon />
                </span>
                <div className="profile-ticket__shop-info">
                  <strong>{currentOrder.merchantName?.trim() || '校园食堂档口'}</strong>
                  <p>{activeSubtitle(currentOrder)}</p>
                </div>
                <span className="profile-ticket__stamp" aria-hidden="true">食麦呼</span>
              </div>

              <div className="profile-ticket__divider" aria-hidden="true" />

              <div className="profile-ticket__code-row">
                <div className="profile-ticket__code-col">
                  <span className="profile-ticket__label">取餐码</span>
                  <strong className="profile-ticket__code">
                    {currentOrder.pickupCode || '待出码'}
                  </strong>
                </div>
                <div className="profile-ticket__sep" aria-hidden="true" />
                <div className="profile-ticket__time-col">
                  <span className="profile-ticket__label">
                    <ClockIcon />
                    预计取餐时间
                  </span>
                  <strong className="profile-ticket__time">
                    {formatSlotBefore(currentOrder.slotEnd)}
                  </strong>
                </div>
              </div>
            </button>
          ) : (
            <button type="button" className="profile-ticket__empty" onClick={onGoToMenu}>
              <span className="profile-ticket__bowl">
                <BowlBadgeIcon />
              </span>
              <div className="profile-ticket__shop-info">
                <strong>当前暂无进行中订单</strong>
                <p>去挑选一份喜欢的校园餐食，预约时段免排队</p>
              </div>
              <ChevronRightIcon />
            </button>
          )}
        </section>

        {/* 4. 常用服务卡片 */}
        <section className="profile-card profile-services-card" aria-label="常用服务">
          <div className="profile-card__head">
            <div className="profile-card__title-group">
              <GridIcon />
              <h2>常用服务</h2>
            </div>
          </div>

          <div className="profile-services-grid">
            <button type="button" className="profile-services-grid__item" onClick={() => setModal('location')}>
              <span className="profile-services-grid__icon is-amber">
                <PinIcon />
              </span>
              <span>位置与隐私</span>
            </button>

            <button type="button" className="profile-services-grid__item" onClick={() => setModal('dining')}>
              <span className="profile-services-grid__icon">
                <BookIcon />
              </span>
              <span>用餐说明</span>
            </button>

            <button type="button" className="profile-services-grid__item" onClick={() => setModal('feedback')}>
              <span className="profile-services-grid__icon">
                <FeedbackIcon />
              </span>
              <span>意见反馈</span>
            </button>
          </div>
        </section>

        {/* 5. 隐私保护条 */}
        <button
          type="button"
          className="profile-privacy-card"
          onClick={() => setModal('location')}
        >
          <span className="profile-privacy-card__icon">
            <ShieldIcon />
          </span>
          <div className="profile-privacy-card__text">
            <strong>隐私保护</strong>
            <p>位置信息仅用于校园食堂服务，不会持续跟踪。</p>
          </div>
          <span className="profile-privacy-card__arrow">
            <ChevronRightIcon />
          </span>
        </button>

        <footer className="profile-footer">
          <span className="profile-footer__line" aria-hidden="true" />
          <span>食麦呼 · 让每一餐都刚刚好</span>
          <span className="profile-footer__line" aria-hidden="true" />
        </footer>
      </main>

      {/* 底部导航栏 */}
      <nav className="profile-nav" aria-label="学生端导航">
        <button type="button" onClick={onGoToShop}>
          <HomeIcon />
          <span>首页</span>
        </button>
        <button type="button" onClick={onGoToMenu}>
          <BowlIcon />
          <span>点餐</span>
        </button>
        <button type="button" onClick={onOpenOrders}>
          <OrdersIcon />
          <span>订单</span>
        </button>
        <button type="button" className="is-active" aria-current="page">
          <UserIcon />
          <span>我的</span>
        </button>
      </nav>

      {/* 弹窗 1：位置与隐私保护 */}
      {modal === 'location' ? (
        <div className="profile-modal-backdrop" onClick={() => setModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="loc-modal-title">
            <div className="profile-modal__head">
              <h3 id="loc-modal-title" className="profile-modal__title">位置信息与隐私保护</h3>
              <button type="button" className="profile-modal__close" onClick={() => setModal(null)} aria-label="关闭">×</button>
            </div>
            <div className="profile-modal__body">
              <p>1. <strong>仅用于堂食拥挤参考</strong>：在您选择堂食并授权定位时，仅用于判断是否已到达食堂区域，辅助测算堂食座位热度。</p>
              <p>2. <strong>不持续后台跟踪</strong>：平台不会在后台持续获取您的位置，每次判断仅在取餐预约界面一次性执行并设定过期时间。</p>
              <p>3. <strong>拒绝不影响下单</strong>：即使您拒绝授权定位或关闭定位服务，您依然可以正常下单并自选堂食或外带。</p>
              <p>4. <strong>随时自主清除</strong>：您可随时清除云端位置判断记录，绝不会影响或删除您的订单。</p>
              <div className="profile-modal__actions">
                <button
                  type="button"
                  className="profile-modal__btn-primary"
                  disabled={clearing}
                  onClick={handleClearLocation}
                >
                  {clearing ? '正在清除…' : '清除位置判断记录'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 弹窗 2：用餐说明 */}
      {modal === 'dining' ? (
        <div className="profile-modal-backdrop" onClick={() => setModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="din-modal-title">
            <div className="profile-modal__head">
              <h3 id="din-modal-title" className="profile-modal__title">校园预约用餐说明</h3>
              <button type="button" className="profile-modal__close" onClick={() => setModal(null)} aria-label="关闭">×</button>
            </div>
            <div className="profile-modal__body">
              <p>1. <strong>预约时段取餐</strong>：请在预约的时段前往所选档口出示取餐码取餐，避免错峰拥堵与长时间排队。</p>
              <p>2. <strong>取餐码出示</strong>：订单状态变为“待取餐”后将显示专属取餐码，请向档口工作人员出示以便核销出餐。</p>
              <p>3. <strong>取消与退款</strong>：档口接单前可申请取消；接单制作中若需取消请提交申请，由档口确认后同步模拟退款。</p>
              <p>4. <strong>文明用餐</strong>：堂食用餐完毕后请配合将餐盘送至食堂回收处，共同维护整洁舒心的就餐环境。</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* 弹窗 3：意见反馈 */}
      {modal === 'feedback' ? (
        <div className="profile-modal-backdrop" onClick={() => setModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="fb-modal-title">
            <div className="profile-modal__head">
              <h3 id="fb-modal-title" className="profile-modal__title">意见反馈</h3>
              <button type="button" className="profile-modal__close" onClick={() => setModal(null)} aria-label="关闭">×</button>
            </div>
            <div className="profile-modal__body">
              <p>如遇出餐或订单问题，请凭订单号联系对应食堂档口；您也可在此记录界面体验建议：</p>
              <textarea
                className="profile-modal__textarea"
                rows={3}
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="请输入建议或问题（当前本地演示记录，不上传服务端）"
              />
              <div className="profile-modal__actions">
                <button type="button" className="profile-modal__btn-primary" onClick={handleSubmitFeedback}>
                  记录反馈
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 弹窗 4：账号与设置 */}
      {modal === 'settings' ? (
        <div className="profile-modal-backdrop" onClick={() => setModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="set-modal-title">
            <div className="profile-modal__head">
              <h3 id="set-modal-title" className="profile-modal__title">账号与设置</h3>
              <button type="button" className="profile-modal__close" onClick={() => setModal(null)} aria-label="关闭">×</button>
            </div>
            <div className="profile-modal__body">
              <p><strong>当前账号</strong>：{displayName}</p>
              <p><strong>数据模式</strong>：{source.mode === 'sample' ? '演示模式（样例数据）' : '真实模式（公共服务）'}</p>
              <div className="profile-modal__actions">
                <button
                  type="button"
                  className="profile-modal__btn-secondary"
                  disabled={clearing}
                  onClick={handleClearLocation}
                >
                  {clearing ? '正在清除…' : '清除位置判断记录'}
                </button>
                <button type="button" className="profile-modal__btn-danger" onClick={handleLogout}>
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="profile-toast" role="status">{toast}</div>
      ) : null}
    </div>
  );
}
