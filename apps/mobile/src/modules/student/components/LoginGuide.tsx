import type { StudentSessionGate } from '../state/sessionGate';

export interface LoginGuideProps {
  gate: StudentSessionGate;
  onRecheck: () => void;
  onBack: () => void;
}

export default function LoginGuide({ gate, onRecheck, onBack }: LoginGuideProps) {
  function goToLogin(): void {
    window.location.hash = '/system-check';
  }

  return (
    <section className="student-login-guide" aria-labelledby="student-login-title" role="alert">
      <h3 id="student-login-title" className="student-login-guide__title">
        需要先完成登录
      </h3>
      <p className="student-login-guide__message">{gate.message}</p>
      <p className="student-login-guide__hint">
        登录入口在公共自检页，学生端不提供账号密码输入，也不会代填或保存凭据。
      </p>
      <div className="student-login-guide__actions">
        <button type="button" className="student-primary" onClick={onRecheck}>
          我已完成登录，重新检查
        </button>
        <button type="button" className="student-secondary" onClick={goToLogin}>
          去公共入口登录
        </button>
        <button type="button" className="student-secondary" onClick={onBack}>
          返回菜单
        </button>
      </div>
    </section>
  );
}