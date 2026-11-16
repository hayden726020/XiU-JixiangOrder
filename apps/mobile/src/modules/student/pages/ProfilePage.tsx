import { useState } from 'react';
import type { StudentSource } from '../types';
import { useStudentSessionGate } from '../state/useStudentSessionGate';
import { clearSession } from '../../../shared/session';
import { clearPresence } from '../../../shared/location';
import SampleBanner from '../components/SampleBanner';
import StudentTabBar from '../components/StudentTabBar';
import studentAvatar from '../assets/student-avatar.png';
import '../profile.css';

export interface ProfilePageProps {
  source: StudentSource;
  onOpenOrders: () => void;
  onGoToShop: () => void;
  onGoToMenu: () => void;
}

type ModalType = 'location' | 'dining' | null;

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem' }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function ProfilePage({
  source,
  onOpenOrders,
  onGoToShop,
  onGoToMenu,
}: ProfilePageProps) {
  const { gate, refresh } = useStudentSessionGate();
  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

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
        await new Promise((resolve) => setTimeout(resolve, 300));
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
    showToast('已退出当前账号');
  }

  // 昵称与身份
  const displayName = gate.usable ? gate.identityText : '同学，你好';

  return (
    <div className="student-profile" aria-labelledby="profile-title">
      {/* 顶部指示条 */}
      {source.mode === 'sample' ? <SampleBanner /> : null}

      {/* 顶部封面背景与大标题 */}
      <header className="profile-hero">
        <div className="profile-hero__topbar">
          <span className="profile-hero__time">10:24</span>
        </div>
        <div className="profile-hero__title-wrap">
          <h1 id="profile-title" className="profile-hero__title">我的</h1>
          <span className="profile-hero__sparkles" aria-hidden="true">✨</span>
        </div>
      </header>

      {/* 页面内容流 */}
      <main className="profile-content">
        {/* 1. 学生个人信息拍立得卡片 */}
        <section className="profile-user-card" aria-label="学生个人档案">
          <div className="profile-user-card__tape" aria-hidden="true" />
          <div className="profile-user-card__avatar-frame">
            <img src={studentAvatar} alt="学生卡通头像" />
          </div>
          <div className="profile-user-card__info">
            <div className="profile-user-card__name-row">
              <h2 className="profile-user-card__name">{displayName}</h2>
              <span className="profile-user-card__badge">学生账号</span>
            </div>
            <p className="profile-user-card__motto">好好吃饭，元气满满</p>
          </div>
        </section>

        {/* 2. 功能选项列表卡片 */}
        <section className="profile-menu-card" aria-label="功能菜单">
          <button type="button" className="profile-menu-item" onClick={onOpenOrders}>
            <div className="profile-menu-item__left">
              <div className="profile-menu-item__icon">
                <ClipboardIcon />
              </div>
              <span className="profile-menu-item__label">我的订单</span>
            </div>
            <span className="profile-menu-item__arrow">
              <ChevronRightIcon />
            </span>
          </button>

          <button type="button" className="profile-menu-item" onClick={() => setModal('location')}>
            <div className="profile-menu-item__left">
              <div className="profile-menu-item__icon">
                <PinIcon />
              </div>
              <span className="profile-menu-item__label">位置信息与隐私</span>
            </div>
            <span className="profile-menu-item__arrow">
              <ChevronRightIcon />
            </span>
          </button>

          <button type="button" className="profile-menu-item" onClick={() => setModal('dining')}>
            <div className="profile-menu-item__left">
              <div className="profile-menu-item__icon">
                <BookIcon />
              </div>
              <span className="profile-menu-item__label">用餐说明</span>
            </div>
            <span className="profile-menu-item__arrow">
              <ChevronRightIcon />
            </span>
          </button>

          <button type="button" className="profile-menu-item" onClick={handleLogout}>
            <div className="profile-menu-item__left">
              <div className="profile-menu-item__icon">
                <LogoutIcon />
              </div>
              <span className="profile-menu-item__label">退出登录</span>
            </div>
            <span className="profile-menu-item__arrow">
              <ChevronRightIcon />
            </span>
          </button>
        </section>

        {/* 3. 隐私与定位控制便签卡片 */}
        <section className="profile-location-card" aria-label="位置信息参考与隐私">
          <div className="profile-location-card__head">
            <div className="profile-location-card__pin-wrap">
              <PinIcon />
              <span className="profile-location-card__spark" aria-hidden="true">✨</span>
            </div>
            <div className="profile-location-card__text">
              <h3 className="profile-location-card__title">仅用于堂食参考</h3>
              <p className="profile-location-card__desc">不持续跟踪，拒绝不影响下单</p>
            </div>
          </div>
          <button
            type="button"
            className="profile-location-card__btn"
            disabled={clearing}
            onClick={handleClearLocation}
          >
            {clearing ? '正在清除…' : '清除位置判断记录'}
          </button>
          <p className="profile-location-card__subnote">不会删除订单</p>
        </section>

        {/* 4. 底部品牌页脚 */}
        <footer className="profile-footer">
          食麦呼 · 校园预约取餐
        </footer>
      </main>

      {/* 底部导航栏：对齐参考图样式，我的 Tab 具备专属高亮 */}
      <StudentTabBar
        active="profile"
        onGoHome={onGoToShop}
        onGoOrder={onGoToMenu}
        onOpenOrders={onOpenOrders}
        onOpenProfile={() => undefined}
      />

      {/* 弹窗 1：位置信息与隐私 */}
      {modal === 'location' ? (
        <div className="profile-modal-backdrop" onClick={() => setModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="loc-modal-title">
            <div className="profile-modal__head">
              <h3 id="loc-modal-title" className="profile-modal__title">位置信息与隐私说明</h3>
              <button type="button" className="profile-modal__close" onClick={() => setModal(null)} aria-label="关闭">×</button>
            </div>
            <div className="profile-modal__body">
              <p>1. <strong>仅用于堂食拥挤参考</strong>：在您选择堂食并授权定位时，仅用于判断是否已到达食堂区域，辅助测算堂食座位热度。</p>
              <p>2. <strong>不持续后台跟踪</strong>：平台不会在后台持续获取您的位置，每次判断仅在取餐预约界面一次性执行并设定过期时间。</p>
              <p>3. <strong>拒绝不影响下单</strong>：即使您拒绝授权定位或关闭定位服务，您依然可以正常下单并自选堂食或外带。</p>
              <p>4. <strong>随时自主清除</strong>：您可随时点击“清除位置判断记录”注销云端记录，且该操作绝不会影响或删除您已提交的订单。</p>
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
              <p>2. <strong>取餐码出示</strong>：订单状态变为“可取餐”后将显示专属取餐码，请向档口阿姨出示以便快速核销出餐。</p>
              <p>3. <strong>取消与退款</strong>：档口接单前可自主取消；接单制作中若需取消请提交申请，由档口确认后同步模拟退款。</p>
              <p>4. <strong>文明用餐</strong>：堂食用餐完毕后请配合将餐盘送至食堂回收处，共同维护整洁舒心的就餐环境。</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* 轻提示 Toast */}
      {toast ? (
        <div className="profile-toast" role="status">{toast}</div>
      ) : null}
    </div>
  );
}
