import type { PollingState } from '../state/orderPolling';
import type { StudentMode } from '../types';
import { formatLocalReadAt } from './detailReadView';

export interface PollingView {
  showText: boolean;
  text: string;
  tone: 'active' | 'paused' | 'stopped' | 'none';
  stateAttr: PollingState['phase'];
  reasonAttr: string;
  lastReadText: string;
}

const ACTIVE_TEXT = '自动刷新中：页面可见且订单未结束时每 5 秒读取一次。';
const PAUSED_TEXT = '自动刷新已暂停，可手动刷新。';
const STOPPED_TEXT = '自动刷新已停止：订单已结束。';

export function derivePollingView(
  state: PollingState,
  opts: { mode: StudentMode; hasOrder: boolean; lastReadAt: Date | null },
): PollingView {
  const real = opts.mode === 'real';
  const base = {
    stateAttr: state.phase,
    reasonAttr: state.reason ?? '',
    lastReadText: '',
  };

  if (!real || !opts.hasOrder) {
    return { ...base, showText: false, text: '', tone: 'none' };
  }

  if (state.phase === 'active') {
    return { ...base, showText: true, text: ACTIVE_TEXT, tone: 'active' };
  }

  if (state.phase === 'paused' && state.reason === 'failed') {
    const lastReadText =
      opts.lastReadAt !== null
        ? `上次读取时间（本机）：${formatLocalReadAt(opts.lastReadAt)}`
        : '';
    return {
      ...base,
      showText: true,
      text: PAUSED_TEXT,
      tone: 'paused',
      lastReadText,
    };
  }

  if (state.phase === 'stopped' && state.reason === 'terminal') {
    return { ...base, showText: true, text: STOPPED_TEXT, tone: 'stopped' };
  }

  return { ...base, showText: false, text: '', tone: 'none' };
}