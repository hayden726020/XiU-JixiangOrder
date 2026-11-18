export type SessionRole = 'STUDENT' | 'MERCHANT' | 'ADMIN';

export interface SessionUser {
  id: string;
  displayName: string;
  role: SessionRole;
  studentId?: string;
  merchantId?: string;
}

export interface Session {
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: SessionUser;
}

const STORAGE_KEY = 'xiu.mobile.session.v1';
const listeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRole(value: unknown): value is SessionRole {
  return value === 'STUDENT' || value === 'MERCHANT' || value === 'ADMIN';
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) {
    return false;
  }
  const user = value.user;
  return (
    typeof value.token === 'string' &&
    value.token.length > 0 &&
    value.tokenType === 'Bearer' &&
    typeof value.expiresAt === 'string' &&
    isRecord(user) &&
    typeof user.id === 'string' &&
    typeof user.displayName === 'string' &&
    isRole(user.role)
  );
}

function isExpired(session: Session, now: number = Date.now()): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now;
}

function readStoredSession(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (isExpired(parsed)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

let currentSession: Session | null = readStoredSession();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getSession(): Session | null {
  return currentSession;
}

export function getAccessToken(): string | null {
  return currentSession?.token ?? null;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveSession(session: Session): void {
  currentSession = session;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 存储不可用时仍保留内存会话，刷新后需要重新登录。
  }
  notify();
}

export function clearSession(): void {
  currentSession = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储清理失败，内存会话已清除。
  }
  notify();
}

export function sessionIsExpired(session: Session): boolean {
  return isExpired(session);
}

export function roleLabel(role: SessionRole): string {
  switch (role) {
    case 'STUDENT':
      return '学生';
    case 'MERCHANT':
      return '档口';
    case 'ADMIN':
      return '管理员';
  }
}