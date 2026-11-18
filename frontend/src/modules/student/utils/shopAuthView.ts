import type { StudentSessionGate } from '../state/sessionGate';
import type { SourceError, StudentMode } from '../types';

export type ShopAuthReason = 'unauthenticated' | 'session-expired' | 'forbidden';

export interface ShopAuthGate {
  active: boolean;
  reason: ShopAuthReason | null;
  notice: string;
}

export interface DeriveShopAuthGateInput {
  mode: StudentMode;
  gate: StudentSessionGate;
  error: SourceError | null;
  recheckNotice?: boolean;
}

export const RECHECK_STILL_SIGNED_OUT_NOTICE = '仍未完成登录，请先在公共入口完成登录。';

function reasonFromGate(kind: StudentSessionGate['kind']): ShopAuthReason | null {
  if (kind === 'missing') {
    return 'unauthenticated';
  }
  if (kind === 'expired') {
    return 'session-expired';
  }
  if (kind === 'wrong-role') {
    return 'forbidden';
  }
  return null;
}

function reasonFromError(error: SourceError): ShopAuthReason | null {
  if (error.code === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  if (error.code === 'SESSION_EXPIRED') {
    return 'session-expired';
  }
  if (error.code === 'FORBIDDEN') {
    return 'forbidden';
  }
  return null;
}

export function deriveShopAuthGate({
  mode,
  gate,
  error,
  recheckNotice = false,
}: DeriveShopAuthGateInput): ShopAuthGate {
  if (mode !== 'real') {
    return { active: false, reason: null, notice: '' };
  }

  if (!gate.usable) {
    const reason = reasonFromGate(gate.kind);
    if (reason !== null) {
      return {
        active: true,
        reason,
        notice: recheckNotice ? RECHECK_STILL_SIGNED_OUT_NOTICE : '',
      };
    }
  }

  if (error !== null) {
    const reason = reasonFromError(error);
    if (reason !== null) {
      return {
        active: true,
        reason,
        notice: recheckNotice ? RECHECK_STILL_SIGNED_OUT_NOTICE : '',
      };
    }
  }

  return { active: false, reason: null, notice: '' };
}