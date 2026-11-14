import type { SourceError, StudentOrder } from '../types';

export type DetailReadPhase = 'reading' | 'ready' | 'refreshing' | 'refreshFailed' | 'error';

export interface DetailReadState {
  phase: DetailReadPhase;
  order: StudentOrder | null;
  lastReadAt: Date | null;
  error: SourceError | null;
  refreshError: SourceError | null;
  busy: boolean;
}

export interface ReadGuard {
  next(): number;
  isCurrent(token: number): boolean;
  reset(): void;
}

export function createReadGuard(): ReadGuard {
  let current = 0;
  return {
    next(): number {
      current += 1;
      return current;
    },
    isCurrent(token: number): boolean {
      return token === current;
    },
    reset(): void {
      current += 1;
    },
  };
}

export function initialDetailRead(): DetailReadState {
  return {
    phase: 'reading',
    order: null,
    lastReadAt: null,
    error: null,
    refreshError: null,
    busy: true,
  };
}

export function startInitialRead(state: DetailReadState): DetailReadState {
  void state;
  return initialDetailRead();
}

export function startRefresh(state: DetailReadState): DetailReadState {
  if (state.phase !== 'ready' && state.phase !== 'refreshFailed') {
    return state;
  }
  return {
    ...state,
    phase: 'refreshing',
    refreshError: null,
    busy: true,
  };
}

export function settleRead(
  state: DetailReadState,
  order: StudentOrder,
  now: Date,
): DetailReadState {
  void state;
  return {
    phase: 'ready',
    order,
    lastReadAt: now,
    error: null,
    refreshError: null,
    busy: false,
  };
}

export function failInitialRead(state: DetailReadState, error: SourceError): DetailReadState {
  void state;
  return {
    phase: 'error',
    order: null,
    lastReadAt: null,
    error,
    refreshError: null,
    busy: false,
  };
}

export function failRefresh(
  state: DetailReadState,
  error: SourceError,
  kind: 'retryable' | 'terminal',
): DetailReadState {
  if (kind === 'terminal') {
    return {
      phase: 'error',
      order: null,
      lastReadAt: null,
      error,
      refreshError: null,
      busy: false,
    };
  }
  return {
   
    phase: 'refreshFailed',
    order: state.order,
    lastReadAt: state.lastReadAt,
    error: null,
    refreshError: error,
    busy: false,
  };
}

export type RefreshFailureKind = 'retryable' | 'terminal';

export function classifyRefreshFailure(error: SourceError): RefreshFailureKind {
  if (
    error.code === 'UNAUTHENTICATED' ||
    error.code === 'SESSION_EXPIRED' ||
    error.code === 'FORBIDDEN' ||
    error.code === 'ORDER_NOT_FOUND'
  ) {
    return 'terminal';
  }
  return 'retryable';
}