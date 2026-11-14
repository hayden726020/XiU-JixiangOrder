import type { StudentSessionGate } from '../state/sessionGate';
import type { ShopAuthReason } from '../utils/shopAuthView';
import { loginGuideContent, type LoginGuideScope } from './loginGuideTexts';

export interface LoginGuideProps {
  gate: StudentSessionGate;
  onRecheck: () => void;
  onBack: () => void;
  reason?: ShopAuthReason;
  notice?: string;
  showBack?: boolean;
  scope?: LoginGuideScope;
}

export default function LoginGuide({
  gate,
  onRecheck,
  onBack,
  reason,
  notice = '',
  showBack = true,
  scope = 'detail',
}: LoginGuideProps) {
  function goToLogin(): void {
    window.location.hash = '/system-check';
  }

  const content = reason ? loginGuideContent({ reason, scope }) : null;
  const title = content?.title ?? '需要先完成登录';
  const description = content?.description ?? gate.message;

  return (
    <section
      className="student-login-guide"
      aria-labelledby="student-login-title"
      role="alert"
      data-auth-state="login-guide"
      data-auth-reason={reason ?? ''}
    >
      <h3 id="student-login-title" className="student-login-guide__title">
        {title}
      </h3>
      <p className="student-login-guide__message">{description}</p>
      <p className="student-login-guide__hint">
        登录入口在公共自检页，学生端不提供账号密码输入，也不会代填或保存凭据。
      </p>
      {notice ? (
        <p className="student-login-guide__notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="student-login-guide__actions">
        <button type="button" className="student-primary" onClick={onRecheck}>
          我已完成登录，重新检查
        </button>
        <button type="button" className="student-secondary" onClick={goToLogin}>
          去公共入口登录
        </button>
        {showBack ? (
          <button type="button" className="student-secondary" onClick={onBack}>
            返回菜单
          </button>
        ) : null}
      </div>
    </section>
  );
}