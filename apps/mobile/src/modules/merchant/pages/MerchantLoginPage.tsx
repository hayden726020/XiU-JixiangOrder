import { useState, type FormEvent } from 'react';
import { ApiError, demoLogin, roleLabel } from '../../../shared';
import { clearSession, type Session } from '../../../shared/session';
import '../login.css';

export interface MerchantLoginPageProps {
  session: Session | null;
  devDemoPassword?: string;
  apiBaseUrl: string | null;
  apiBaseProblem?: string | null;
  onLoggedIn: () => void;
  onUseSample: () => void;
}

function describeLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '登录未完成，请稍后重试。';
  }
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return '账号或密码不正确，请核对管理员线下提供的档口演示账号。';
    case 'API_BASE_NOT_CONFIGURED':
      return `登录服务地址尚未配置：${error.message}`;
    case 'NETWORK_ERROR':
    case 'NETWORK_TIMEOUT':
    case 'NOT_FOUND':
    case 'HTTP_ERROR':
      return `${error.message} 请先在「服务与登录自检」里确认服务地址是否可用。`;
    default:
      return `${error.message}（${error.code}）`;
  }
}

function FieldIcon({ type }: { type: 'account' | 'password' }) {
  return (
    <svg
      className="merchant-login-field__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'account' ? (
        <>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        </>
      ) : (
        <>
          <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
          <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
        </>
      )}
    </svg>
  );
}

export default function MerchantLoginPage({
  session,
  devDemoPassword,
  apiBaseUrl,
  apiBaseProblem,
  onLoggedIn,
  onUseSample,
}: MerchantLoginPageProps) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherRoleMessage =
    session && session.user.role !== 'MERCHANT'
      ? `当前登录身份是${roleLabel(session.user.role)}，不是档口账号；登录档口账号会覆盖当前会话。`
      : '';

  async function signIn(nextAccount: string, nextPassword: string): Promise<void> {
    if (busy) {
      return;
    }
    if (nextAccount.trim().length === 0 || nextPassword.length === 0) {
      setError('请输入档口演示账号与密码。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const loggedIn = await demoLogin(nextAccount, nextPassword);
      if (loggedIn.user.role !== 'MERCHANT') {
        clearSession();
        setPassword('');
        setError(`该账号的角色是${roleLabel(loggedIn.user.role)}，不是档口；请使用档口演示账号。`);
        return;
      }
      setPassword('');
      onLoggedIn();
    } catch (loginError) {
      setPassword('');
      setError(describeLoginError(loginError));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void signIn(account, password);
  }

  return (
    <section className="merchant-login-screen" aria-labelledby="merchant-login-heading">
      <header className="merchant-login-hero">
        <div className="merchant-login-hero__top">
          <p className="merchant-login-brand">吉祥点餐</p>
          <span className="merchant-login-hero__tag">档口端 · 先登录再入驻</span>
        </div>
        <h2 id="merchant-login-heading">档口工作台</h2>
        <p className="merchant-login-hero__lead">
          接单、制作、标记可取与核销都写入共同服务，需要先登录档口账号。
        </p>
      </header>

      <div className="merchant-login-card">
        <h3 className="merchant-login-card__title">档口账号登录</h3>

        {otherRoleMessage ? (
          <p className="merchant-login-gate" role="status">
            {otherRoleMessage}
          </p>
        ) : null}

        <form className="merchant-login-form" onSubmit={handleSubmit} noValidate>
          <div className="merchant-login-field">
            <FieldIcon type="account" />
            <label htmlFor="merchant-login-account">账号</label>
            <span className="merchant-login-field__divider" aria-hidden="true" />
            <input
              id="merchant-login-account"
              name="account"
              type="text"
              value={account}
              placeholder="请输入档口演示账号"
              autoComplete="username"
              maxLength={120}
              disabled={busy}
              onChange={(event) => setAccount(event.target.value)}
            />
          </div>

          <div className="merchant-login-field">
            <FieldIcon type="password" />
            <label htmlFor="merchant-login-password">密码</label>
            <span className="merchant-login-field__divider" aria-hidden="true" />
            <input
              id="merchant-login-password"
              name="password"
              type="password"
              value={password}
              placeholder="请输入密码"
              autoComplete="current-password"
              maxLength={200}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p className="merchant-login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="merchant-login-submit" disabled={busy}>
            {busy ? '正在登录…' : '登录档口端'}
          </button>
        </form>

        {devDemoPassword ? (
          <button
            type="button"
            className="merchant-login-quick"
            disabled={busy}
            onClick={() => void signIn('demo-merchant', devDemoPassword)}
          >
            使用本地演示凭据一键登录（开发环境）
          </button>
        ) : null}

        <p className="merchant-login-hint">
          演示账号与密码由管理员线下提供；登录成功后读取真实菜单与订单，失败不回退样例。
        </p>
      </div>

      <div className="merchant-login-actions">
        <button type="button" className="merchant-login-link" onClick={onUseSample}>
          先看样例数据
        </button>
        <button
          type="button"
          className="merchant-login-link"
          onClick={() => {
            window.location.hash = '/system-check';
          }}
        >
          服务与登录自检
        </button>
        <button
          type="button"
          className="merchant-login-link"
          onClick={() => {
            window.location.hash = '/';
          }}
        >
          返回角色入口
        </button>
      </div>

      <p className="merchant-login-service">
        服务地址：{apiBaseUrl ?? '未配置'}
        {apiBaseProblem ? `（${apiBaseProblem}）` : ''}
      </p>
    </section>
  );
}