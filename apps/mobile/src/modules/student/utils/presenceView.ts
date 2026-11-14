import type { PresenceState } from '../state/presenceRuntime';
import type { PresenceReasonKey } from '../data/presenceAdapter';
import type { StudentMode } from '../types';
import {
  CLEAR_FAILED_TEXT,
  CLEAR_PENDING_TEXT,
  DEMO_RANGE_TEXT,
  EMPTY_LOCATION_HINT,
  PRESENCE_REASON_TEXT,
  PRESENCE_TEXT,
  SYNC_LOGIN_EXPIRED_TEXT,
  SYNC_TEXT,
} from '../components/locationTexts';

export interface PresenceView {
  phase: PresenceState['phase'];
  statusText: string;
  reasonText: string;
  timingText: string;
  demoText: string;
  syncText: string;
  clearText: string;
  hintText: string;
  canLocate: boolean;
  canClear: boolean;
  canRetrySync: boolean;
}

function reasonTextOf(reason: PresenceReasonKey | null): string {
  if (reason === null) {
    return PRESENCE_TEXT.unknown;
  }
  return PRESENCE_REASON_TEXT[reason] ?? PRESENCE_TEXT.unknown;
}

function statusTextOf(state: PresenceState, reasonText: string): string {
  switch (state.phase) {
    case 'loading':
      return PRESENCE_TEXT.loading;
    case 'inside':
      return PRESENCE_TEXT.inside;
    case 'outside':
      return PRESENCE_TEXT.outside;
    case 'unknown':
      return reasonText;
    case 'expired':
      return PRESENCE_TEXT.expired;
    case 'cleared':
      return PRESENCE_TEXT.cleared;
    case 'sample':
      return PRESENCE_TEXT.sample;
    default:
      return '';
  }
}

function timingTextOf(state: PresenceState): string {
  const { checkedAt, expiresAt, source } = state.timing;
  if (state.phase === 'expired' && expiresAt !== null) {
    return `判断已过期（原失效时间：${expiresAt}），可重新获取。`;
  }
  if (checkedAt === null) {
    return '';
  }
  if (source === 'server') {
    return `判断时间：${checkedAt} · 失效时间：${expiresAt ?? '未知'}（服务端时间）。`;
  }
  if (source === 'local') {
    return `本机判断时间：${checkedAt}（未同步，本机推算约 10 分钟后失效）。`;
  }
  return '';
}

export function derivePresenceView(state: PresenceState, mode: StudentMode): PresenceView {
  const reasonText = state.phase === 'unknown' ? reasonTextOf(state.reason) : '';
  const hintText = state.phase === 'idle' ? EMPTY_LOCATION_HINT : '';
  const clearText =
    state.clearing === 'failed'
      ? CLEAR_FAILED_TEXT
      : state.clearing === 'pending'
        ? CLEAR_PENDING_TEXT
        : '';
  const usable = mode === 'real';
  return {
    phase: state.phase,
    statusText: statusTextOf(state, reasonText),
    reasonText,
    timingText: timingTextOf(state),
    demoText: state.demoConfig ? DEMO_RANGE_TEXT : '',
    syncText:
      state.sync.messageKey === 'sync-login-expired'
        ? SYNC_LOGIN_EXPIRED_TEXT
        : (SYNC_TEXT[state.sync.kind] ?? ''),
    clearText,
    hintText,
    canLocate: usable && state.canLocate,
    canClear: usable && state.canClear,
    canRetrySync: usable && state.sync.canRetrySync,
  };
}