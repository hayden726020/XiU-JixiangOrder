import { ApiError, apiRequest } from './apiClient';
import {
  clearSession,
  saveSession,
  type Session,
  type SessionRole,
  type SessionUser,
} from './session';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRole(value: unknown): value is SessionRole {
  return value === 'STUDENT' || value === 'MERCHANT' || value === 'ADMIN';
}

function parseSession(value: unknown): Session | null {
  if (!isRecord(value) || !isRecord(value.user)) {
    return null;
  }
  const user = value.user;
  if (
    typeof value.token !== 'string' ||
    value.token.length === 0 ||
    value.tokenType !== 'Bearer' ||
    typeof value.expiresAt !== 'string' ||
    typeof user.id !== 'string' ||
    typeof user.displayName !== 'string' ||
    !isRole(user.role)
  ) {
    return null;
  }
  return {
    token: value.token,
    tokenType: 'Bearer',
    expiresAt: value.expiresAt,
    user: {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      studentId: typeof user.studentId === 'string' ? user.studentId : undefined,
      merchantId: typeof user.merchantId === 'string' ? user.merchantId : undefined,
    },
  };
}

async function performLogin(
  endpoint: '/auth/login' | '/auth/demo-login',
  account: string,
  password: string,
): Promise<Session> {
  const trimmedAccount = account.trim();
  if (trimmedAccount.length === 0 || password.length === 0) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: '请输入账号与密码。',
      status: 0,
      retryable: false,
    });
  }

  const data = await apiRequest<unknown>(endpoint, {
    method: 'POST',
    auth: false,
    body: { account: trimmedAccount, password },
  });

  const session = parseSession(data);
  if (!session) {
    throw new ApiError({
      code: 'INVALID_SESSION_RESPONSE',
      message: '登录响应缺少会话或角色信息，未保存登录状态。',
      status: 0,
      retryable: false,
    });
  }

  saveSession(session);
  return session;
}

export async function login(account: string, password: string): Promise<Session> {
  return performLogin('/auth/login', account, password);
}

export async function demoLogin(account: string, password: string): Promise<Session> {
  return performLogin('/auth/demo-login', account, password);
}

export interface StudentRegistrationResult {
  registered: true;
}

export async function registerStudentAccount(
  account: string,
  password: string,
): Promise<StudentRegistrationResult> {
  const trimmedAccount = account.trim();
  const data = await apiRequest<unknown>('/auth/student-register', {
    method: 'POST',
    auth: false,
    body: { account: trimmedAccount, password },
  });
  if (!isRecord(data) || data.registered !== true) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '注册响应格式不正确。',
      status: 0,
      retryable: false,
    });
  }
  return { registered: true };
}

export interface SessionIdentity {
  user: SessionUser;
  canteenId: string | null;
}

export async function loadSessionIdentity(): Promise<SessionIdentity> {
  const data = await apiRequest<unknown>('/me');
  if (!isRecord(data) || !isRecord(data.user)) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '当前身份响应格式不正确。',
      status: 0,
      retryable: false,
    });
  }
  const user = data.user;
  if (
    typeof user.id !== 'string' ||
    typeof user.displayName !== 'string' ||
    !isRole(user.role)
  ) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '当前身份响应缺少角色信息。',
      status: 0,
      retryable: false,
    });
  }
  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      studentId: typeof user.studentId === 'string' ? user.studentId : undefined,
      merchantId: typeof user.merchantId === 'string' ? user.merchantId : undefined,
    },
    canteenId: typeof data.canteenId === 'string' ? data.canteenId : null,
  };
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}