import { useState, type FormEvent } from 'react';
import { login, registerStudentAccount, roleLabel } from '../../../shared';
import { clearSession } from '../../../shared/session';
import type { StudentSessionGate } from '../state/sessionGate';
import {
  describeAuthError,
  validateStudentRegisterInput,
  type StudentAuthMode,
} from '../utils/authView';
import '../login.css';

export interface LoginPageProps {
  gate: StudentSessionGate;
}

const GATE_MESSAGE: Record<StudentSessionGate['kind'], string> = {
  ok: '',
  missing: '',
  expired: '登录已过期，请重新输入学生账号登录。',
  'wrong-role': '当前登录不是学生身份，请改用学生账号登录。',
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
  const [mode, setMode] = useState<StudentAuthMode>('login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredNotice, setRegisteredNotice] = useState<string | null>(null);

  const gateMessage = GATE_MESSAGE[gate.kind];
  const submitDisabled = busy;
  const isRegister = mode === 'register';

  function switchMode(nextMode: StudentAuthMode): void {
    if (busy || nextMode === mode) {
      return;
    }
    setMode(nextMode);
    setPassword('');
    setError(null);
    if (nextMode === 'register') {
      setRegisteredNotice(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    if (isRegister) {
      const validationMessage = validateStudentRegisterInput(account, password);
      if (validationMessage) {
        setError(validationMessage);
        return;
      }
      setBusy(true);
      setError(null);
      setRegisteredNotice(null);
      try {
        const normalizedAccount = account.trim().toLowerCase();
        await registerStudentAccount(account, password);
        setAccount(normalizedAccount);
        setPassword('');
        setMode('login');
        setRegisteredNotice(`账号「${normalizedAccount}」注册成功，请输入密码登录。`);
      } catch (registerError) {
        setError(describeAuthError(registerError, 'register'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (account.trim().length === 0 || password.length === 0) {
      setError('请输入学生账号与密码。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await login(account, password);
      if (session.user.role !== 'STUDENT') {
        clearSession();
        setPassword('');
        setError(`该账号的角色是${roleLabel(session.user.role)}，不是学生；请使用学生账号登录。`);
        return;
      }
      setPassword('');
      setRegisteredNotice(null);
    } catch (loginError) {
      setPassword('');
      setError(describeAuthError(loginError, 'login'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-login-screen" aria-labelledby="student-login-heading">
      <header className="student-login-brand">
        <div className="student-login-brand__row">
          <p className="student-login-brand__name">
            食麦呼
            <svg className="student-login-brand__spark" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 1.5c.9 4.6 2.9 6.6 7.5 7.5-4.6.9-6.6 2.9-7.5 7.5-.9-4.6-2.9-6.6-7.5-7.5 4.6-.9 6.6-2.9 7.5-7.5Z"
                fill="#E8CC75"
              />
              <path
                d="M19.5 15.5c.45 2.3 1.45 3.3 3.75 3.75-2.3.45-3.3 1.45-3.75 3.75-.45-2.3-1.45-3.3-3.75-3.75 2.3-.45 3.3-1.45 3.75-3.75Z"
                fill="#E8CC75"
              />
            </svg>
          </p>
          <p className="student-login-brand__tag">校园点餐</p>
        </div>

        <p className="student-login-brand__subtitle">欢迎来到食麦呼</p>

        <div className="student-login-brand__title-wrap">
          <h1 id="student-login-heading" className="student-login-brand__title">
            吃好每一餐
          </h1>
          <svg className="student-login-brand__underline" viewBox="0 0 180 16" fill="none" aria-hidden="true">
            <path d="M4 11C58 2 122 3.5 176 12" stroke="#E8CC75" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <svg className="student-login-brand__swirl" viewBox="0 0 90 40" fill="none" aria-hidden="true">
            <path
              d="M6 30C18 10 40 4 56 10c14 5 24 18 14 24-8 5-20 1-18-6"
              stroke="#E8CC75"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <svg className="student-login-brand__stars" viewBox="0 0 64 48" fill="none" aria-hidden="true">
            <path
              d="M30 4c.75 3.9 2.45 5.6 6.35 6.35-3.9.75-5.6 2.45-6.35 6.35-.75-3.9-2.45-5.6-6.35-6.35 3.9-.75 5.6-2.45 6.35-6.35Z"
              fill="#E8CC75"
            />
            <path
              d="M46 24c.55 2.85 1.8 4.1 4.65 4.65-2.85.55-4.1 1.8-4.65 4.65-.55-2.85-1.8-4.1-4.65-4.65 2.85-.55 4.1-1.8 4.65-4.65Z"
              fill="#E8CC75"
            />
            <path
              d="M12 30c.4 2.1 1.3 3 3.4 3.4-2.1.4-3 1.3-3.4 3.4-.4-2.1-1.3-3-3.4-3.4 2.1-.4 3-1.3 3.4-3.4Z"
              fill="#F3E3B5"
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

      <div className="student-login-card" data-auth-mode={mode}>
        <div className="student-login-card__head">
          <h2 className="student-login-card__title">
            {isRegister ? '学生账号注册' : '学生端登录'}
          </h2>
          <div className="student-login-mode-switch" role="tablist" aria-label="登录与注册切换">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={`student-login-mode-switch__btn${!isRegister ? ' is-active' : ''}`}
              disabled={busy}
              onClick={() => switchMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={`student-login-mode-switch__btn${isRegister ? ' is-active' : ''}`}
              disabled={busy}
              onClick={() => switchMode('register')}
            >
              注册
            </button>
          </div>
        </div>

        {!isRegister && registeredNotice ? (
          <p className="student-login-card__success" role="status">
            {registeredNotice}
          </p>
        ) : null}

        {!isRegister && gateMessage ? (
          <p className="student-login-card__gate" role="status">
            {gateMessage}
          </p>
        ) : null}

        {isRegister ? (
          <div className="student-login-rules" aria-label="注册规则说明">
            <span className="student-login-rules__chip">账号：4–32 位字母/数字/下划线</span>
            <span className="student-login-rules__chip">密码：8–128 位 · 注册后登录</span>
          </div>
        ) : null}

        <form className="student-login-form" onSubmit={handleSubmit} noValidate>
          <div className="student-login-field">
            <FieldIcon type="account" />
            <label htmlFor="student-login-account">{isRegister ? '注册账号' : '学生账号'}</label>
            <span className="student-login-field__divider" aria-hidden="true" />
            <input
              id="student-login-account"
              name="account"
              type="text"
              value={account}
              placeholder={isRegister ? '4-32 位字母、数字或下划线' : '请输入学生账号或演示账号'}
              autoComplete="username"
              maxLength={isRegister ? 32 : 120}
              disabled={busy}
              onChange={(event) => setAccount(event.target.value)}
            />
          </div>

          <div className="student-login-field">
            <FieldIcon type="password" />
            <label htmlFor="student-login-password">{isRegister ? '设置密码' : '登录密码'}</label>
            <span className="student-login-field__divider" aria-hidden="true" />
            <input
              id="student-login-password"
              name="password"
              type="password"
              value={password}
              placeholder={isRegister ? '设置 8-128 位登录密码' : '请输入密码'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              maxLength={isRegister ? 128 : 200}
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
            <span>
              {busy
                ? isRegister
                  ? '正在注册…'
                  : '正在登录…'
                : isRegister
                  ? '注册学生账号'
                  : '登录学生端'}
            </span>
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

        <div className="student-login-card__switch-row">
          <button
            type="button"
            className="student-login-card__switch-link"
            disabled={busy}
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? '已有学生账号？返回登录 →' : '还没有账号？立即注册学生账号 →'}
          </button>
        </div>

        <p className="student-login-card__hint">
          <span aria-hidden="true" />
          {isRegister ? '注册仅创建学生身份，完成后请登录' : '支持新注册学生账号或线下演示账号'}
          <span aria-hidden="true" />
        </p>
      </div>

      <svg className="student-login-bottombranch" viewBox="0 0 120 90" fill="none" aria-hidden="true">
        <path
          d="M124 4C106 24 86 44 68 62 60 70 54 80 46 88"
          stroke="#B59B5B"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <g stroke="#B59B5B" strokeWidth="1.2" fill="#E8CC75" fillOpacity="0.45">
          <path d="M0 0C12-15 32-17 44-3 32 12 12 12 0 0Z" transform="translate(88 22) rotate(158)" />
          <path d="M0 0C12-15 32-17 44-3 32 12 12 12 0 0Z" transform="translate(70 50) rotate(198)" />
          <path d="M0 0C12-15 32-17 44-3 32 12 12 12 0 0Z" transform="translate(58 74) rotate(150)" />
        </g>
      </svg>

      <footer className="student-login-foot">
        <p>账号与身份由服务端验证</p>
        <p className="student-login-foot__brand">食麦呼 · 校园预约取餐</p>
      </footer>
    </section>
  );
}
