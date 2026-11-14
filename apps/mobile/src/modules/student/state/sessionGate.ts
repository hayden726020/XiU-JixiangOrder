import type { Session } from '../../../shared/session';
import { roleLabel } from '../../../shared/session';

export type SessionGateKind = 'ok' | 'missing' | 'expired' | 'wrong-role';

export interface StudentSessionGate {
  kind: SessionGateKind;
  usable: boolean;
  message: string;
  identityText: string;
  roleLabel: string;
}

const MESSAGES = {
  missing: '请先在公共入口完成演示登录。',
  expired: '登录已过期，请重新登录。',
  'wrong-role': '当前登录不是学生身份，请重新登录学生演示账号。',
} as const;

export function evaluateStudentSession(
  session: Session | null | undefined,
  now: Date = new Date(),
): StudentSessionGate {
  if (!session) {
    return {
      kind: 'missing',
      usable: false,
      message: MESSAGES.missing,
      identityText: '',
      roleLabel: '',
    };
  }

  const expiresAt = Date.parse(session.expiresAt);
  const expired = Number.isNaN(expiresAt) || expiresAt <= now.getTime();
  if (expired) {
    return {
      kind: 'expired',
      usable: false,
      message: MESSAGES.expired,
      identityText: '',
      roleLabel: '',
    };
  }

  if (session.user.role !== 'STUDENT') {
    return {
      kind: 'wrong-role',
      usable: false,
      message: MESSAGES['wrong-role'],
      identityText: '',
      roleLabel: roleLabel(session.user.role),
    };
  }

  return {
    kind: 'ok',
    usable: true,
    message: '',
    identityText: `${session.user.displayName}（${roleLabel(session.user.role)}）`,
    roleLabel: roleLabel(session.user.role),
  };
}