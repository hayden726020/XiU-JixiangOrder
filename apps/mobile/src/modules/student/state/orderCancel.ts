export type CancelPhase =
  | 'idle'
  | 'confirming'
  | 'submitting'
  | 'conflict-read'
  | 'retry-pending'
  | 'blocked-auth'
  | 'failed';

export interface CancelState {
  phase: CancelPhase;
  message: string;
  requestId: string | null;
}

export type CancelEvent =
  | { type: 'open-confirm' }
  | { type: 'cancel-confirm' }
  | { type: 'submit'; requestId: string }
  | { type: 'succeed' }
  | { type: 'conflict' }
  | { type: 'retryable-fail' }
  | { type: 'auth-fail' }
  | { type: 'terminal-fail'; message: string }
  | { type: 'reset' };

export function initialCancelState(): CancelState {
  return { phase: 'idle', message: '', requestId: null };
}

export function reduceCancel(state: CancelState, event: CancelEvent): CancelState {
  switch (event.type) {
    case 'open-confirm':
      return { phase: 'confirming', message: '', requestId: null };
    case 'cancel-confirm':
      return { phase: 'idle', message: '', requestId: null };
    case 'submit':
      return { phase: 'submitting', message: '', requestId: event.requestId };
    case 'succeed':
      return { phase: 'idle', message: '', requestId: null };
    case 'conflict':
      return { phase: 'conflict-read', message: '', requestId: null };
    case 'retryable-fail':
      return {
        phase: 'retry-pending',
        message: '操作结果待确认，请重试；重试不会重复退款。',
        requestId: state.requestId,
      };
    case 'auth-fail':
      return {
        phase: 'blocked-auth',
        message: '登录已失效，请重新登录后继续。',
        requestId: state.requestId,
      };
    case 'terminal-fail':
      return { phase: 'failed', message: event.message, requestId: null };
    case 'reset':
      return initialCancelState();
    default:
      return state;
  }
}

export function isCancelSubmitting(phase: CancelPhase): boolean {
  return phase === 'submitting';
}

export interface CancelReasonCheck {
  ok: boolean;
  reason: string;
  message: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function validateCancelReason(value: string): CancelReasonCheck {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason === '') {
    return { ok: false, reason: '', message: '请填写取消理由。' };
  }
  if (reason.length > 200) {
    return { ok: false, reason, message: '取消理由不能超过 200 字。' };
  }
  if (CONTROL_CHARS.test(reason)) {
    return { ok: false, reason, message: '取消理由包含不可用字符。' };
  }
  return { ok: true, reason, message: '' };
}