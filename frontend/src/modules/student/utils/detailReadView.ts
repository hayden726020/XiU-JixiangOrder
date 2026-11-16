import type { DetailReadState } from '../state/orderRead';
import type { StudentMode } from '../types';
import { sanitizeMessage } from './errorSemantics';

export interface DetailReadView {
  showRefreshEntry: boolean;
  refreshButtonText: string;
  canRefresh: boolean;
  refreshNoticeText: string;
  lastReadText: string;
  updatedLabelSuffix: string;
  busy: boolean;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalReadAt(at: Date | null): string {
  if (!at || Number.isNaN(at.getTime())) {
    return '';
  }
  return `${at.getMonth() + 1}月${at.getDate()}日 ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

export function deriveDetailReadView(
  state: DetailReadState,
  mode: StudentMode,
): DetailReadView {
  const real = mode === 'real';
  const refreshFailed = state.phase === 'refreshFailed';
  const showRefreshEntry =
    real &&
    (state.phase === 'ready' ||
      state.phase === 'refreshing' ||
      state.phase === 'refreshFailed');
  const canRefresh =
    real && (state.phase === 'ready' || state.phase === 'refreshFailed');
  const notice =
    refreshFailed && state.refreshError
      ? `刷新失败：${sanitizeMessage(state.refreshError.message, '请稍后重试')}；以下为上次读取结果。`
      : '';
  return {
    showRefreshEntry,
    refreshButtonText: state.phase === 'refreshing' ? '正在刷新…' : '刷新状态',
    canRefresh,
    refreshNoticeText: notice,
    lastReadText:
      refreshFailed && state.lastReadAt
        ? `上次读取时间（本机）：${formatLocalReadAt(state.lastReadAt)}`
        : '',
    updatedLabelSuffix: refreshFailed ? '（上次读取结果）' : '',
    busy: state.busy,
  };
}