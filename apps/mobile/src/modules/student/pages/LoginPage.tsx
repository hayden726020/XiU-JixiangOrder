import { useState, type FormEvent } from 'react';
import { ApiError, demoLogin, roleLabel } from '../../../shared';
import { clearSession } from '../../../shared/session';
import type { StudentSessionGate } from '../state/sessionGate';
import '../login.css';

export interface LoginPageProps {
  gate: StudentSessionGate;
}

const GATE_MESSAGE: Record<StudentSessionGate['kind'], string> = {
  ok: '',
  missing: '',
  expired: '登录已过期，请重新输入演示账号登录。',
  'wrong-role': '当前登录不是学生身份，请改用学生演示账号登录。',
};

const WALL_PHOTOS = ['cafeteria', 'noodle', 'table', 'rice', 'trays'] as const;

function WallFrames({ reverse = false }: { reverse?: boolean }) {
  const photos = reverse ? [...WALL_PHOTOS].reverse() : WALL_PHOTOS;
  return (
    <>
      {[...photos, ...photos].map((photo, index) => (
        <div
          key={`${photo}-${index}`}
          className={`student-login-wall__frame student-login-wall__frame--${photo}`}
        >
          <div className="student-login-wall__image" />
        </div>
      ))}
    </>
  );
}

function describeLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '登录未完成，请稍后重试。';
  }
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return '账号或密码不正确，请核对管理员线下提供的演示账号。';
    case 'API_BASE_NOT_CONFIGURED':
      return `登录服务地址尚未配置：${error.message}`;
    case 'NETWORK_ERROR':
    case 'NETWORK_TIMEOUT':
    case 'NOT_FOUND':
    case 'HTTP_ERROR':
      return `${error.message} 请先在「公共能力自检」里确认服务地址是否可用。`;
    default:
      return `${error.message}（${error.code}）`;
  }
}

function FieldIcon({ type }: { type: 'account' | 'password' }) {
  return (
    <svg
      className="student-login-field__icon"
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

export default function LoginPage({ gate }: LoginPageProps) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gateMessage = GATE_MESSAGE[gate.kind];
  const submitDisabled = busy;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (account.trim().length === 0 || password.length === 0) {
      setError('请输入演示账号与密码。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await demoLogin(account, password);
      if (session.user.role !== 'STUDENT') {
        clearSession();
        setPassword('');
        setError(`该账号的角色是${roleLabel(session.user.role)}，不是学生；请使用学生演示账号。`);
        return;
      }
      setPassword('');
    } catch (loginError) {
      setPassword('');
      setError(describeLoginError(loginError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-login-screen" aria-labelledby="student-login-heading">
      <header className="student-login-brand">
        <div className="student-login-brand__row">
          <p className="student-login-brand__name">
            吉祥点餐
            <svg className="student-login-brand__spark" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 1.5c.9 4.6 2.9 6.6 7.5 7.5-4.6.9-6.6 2.9-7.5 7.5-.9-4.6-2.9-6.6-7.5-7.5 4.6-.9 6.6-2.9 7.5-7.5Z"
                fill="#FFD525"
              />
              <path
                d="M19.5 15.5c.45 2.3 1.45 3.3 3.75 3.75-2.3.45-3.3 1.45-3.75 3.75-.45-2.3-1.45-3.3-3.75-3.75 2.3-.45 3.3-1.45 3.75-3.75Z"
                fill="#FFD525"
              />
            </svg>
          </p>
          <p className="student-login-brand__tag">校园点餐</p>
        </div>

        <p className="student-login-brand__subtitle">欢迎来到校园食堂</p>

        <div className="student-login-brand__title-wrap">
          <h1 id="student-login-heading" className="student-login-brand__title">
            吃好每一餐
          </h1>
          <svg className="student-login-brand__underline" viewBox="0 0 180 16" fill="none" aria-hidden="true">
            <path d="M4 11C58 2 122 3.5 176 12" stroke="#E5C95C" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <svg className="student-login-brand__swirl" viewBox="0 0 90 40" fill="none" aria-hidden="true">
            <path
              d="M6 30C18 10 40 4 56 10c14 5 24 18 14 24-8 5-20 1-18-6"
              stroke="#E5C95C"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <svg className="student-login-brand__stars" viewBox="0 0 64 48" fill="none" aria-hidden="true">
            <path
              d="M30 4c.75 3.9 2.45 5.6 6.35 6.35-3.9.75-5.6 2.45-6.35 6.35-.75-3.9-2.45-5.6-6.35-6.35 3.9-.75 5.6-2.45 6.35-6.35Z"
              fill="#FFD525"
            />
            <path
              d="M46 24c.55 2.85 1.8 4.1 4.65 4.65-2.85.55-4.1 1.8-4.65 4.65-.55-2.85-1.8-4.1-4.65-4.65 2.85-.55 4.1-1.8 4.65-4.65Z"
              fill="#FFD525"
            />
            <path
              d="M12 30c.4 2.1 1.3 3 3.4 3.4-2.1.4-3 1.3-3.4 3.4-.4-2.1-1.3-3-3.4-3.4 2.1-.4 3-1.3 3.4-3.4Z"
              fill="#E5C95C"
            />
          </svg>
        </div>
      </header>

      <div className="student-login-wall" aria-hidden="true">
        <div className="student-login-wall__row student-login-wall__row--top">
          <WallFrames />
        </div>
        <div className="student-login-wall__row student-login-wall__row--bottom">
          <WallFrames reverse />
        </div>
      </div>

      <div className="student-login-card">
        <h2 className="student-login-card__title">学生端登录</h2>

        {gateMessage ? (
          <p className="student-login-card__gate" role="status">
            {gateMessage}
          </p>
        ) : null}

        <form className="student-login-form" onSubmit={handleSubmit} noValidate>
          <div className="student-login-field">
            <FieldIcon type="account" />
            <label htmlFor="student-login-account">演示账号</label>
            <span className="student-login-field__divider" aria-hidden="true" />
            <input
              id="student-login-account"
              name="account"
              type="text"
              value={account}
              placeholder="请输入演示账号"
              autoComplete="username"
              maxLength={120}
              disabled={busy}
              onChange={(event) => setAccount(event.target.value)}
            />
          </div>

          <div className="student-login-field">
            <FieldIcon type="password" />
            <label htmlFor="student-login-password">密码</label>
            <span className="student-login-field__divider" aria-hidden="true" />
            <input
              id="student-login-password"
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
            <p className="student-login-card__error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="student-login-submit" disabled={submitDisabled}>
            <span>{busy ? '正在登录…' : '登录学生端'}</span>
            <svg
              className="student-login-submit__arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12h15" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </button>
        </form>

        <p className="student-login-card__hint">
          <span aria-hidden="true" />
          演示账号由管理员线下提供
          <span aria-hidden="true" />
        </p>
      </div>

      <svg className="student-login-bottombranch" viewBox="0 0 120 90" fill="none" aria-hidden="true">
        <path
          d="M124 4C106 24 86 44 68 62 60 70 54 80 46 88"
          stroke="#7d9469"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <g stroke="#7d9469" strokeWidth="1.2" fill="#a9c096" fillOpacity="0.55">
          <path d="M0 0C12-15 32-17 44-3 32 12 12 12 0 0Z" transform="translate(88 22) rotate(158)" />
          <path d="M0 0C12-15 32-17 44-3 32 12 12 12 0 0Z" transform="translate(70 50) rotate(198)" />
          <path d="M0 0C12-15 32-17 44-3 32 12 12 12 0 0Z" transform="translate(58 74) rotate(150)" />
        </g>
      </svg>

      <footer className="student-login-foot">
        <p>账号与身份由服务端验证</p>
        <p className="student-login-foot__brand">吉祥点餐 · 校园预约取餐</p>
      </footer>
    </section>
  );
}
