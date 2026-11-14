import type { OrderStatus, SourceError, StudentOrder } from '../types';
import type { RefreshFailureKind } from './orderRead';

export const ORDER_POLL_INTERVAL_MS = 5_000;

export type PollingPhase = 'off' | 'active' | 'paused' | 'stopped';

export type PollingStopReason =
  | 'hidden'
  | 'failed'
  | 'terminal'
  | 'unmounted'
  | 'auth'
  | 'forbidden'
  | 'not-found';

export type PollingOffReason =
  | 'not-started'
  | 'sample'
  | 'blocked'
  | 'initial-reading'
  | 'initial-failed';

export interface PollingState {
  phase: PollingPhase;
  reason: PollingStopReason | null;
  offReason: PollingOffReason | null;
  inFlight: boolean;
  manualInFlight: boolean;
  nextDueAt: number | null;
  autoReadCount: number;
}

export type PollingEvent =
  | { type: 'initial-succeeded'; order: StudentOrder; now: number }
  | { type: 'initial-failed' }
  | { type: 'tick'; now: number }
  | { type: 'auto-succeeded'; order: StudentOrder; now: number }
  | { type: 'auto-failed'; error: SourceError }
  | { type: 'auto-dropped' }
  | { type: 'manual-started' }
  | { type: 'manual-succeeded'; order: StudentOrder; now: number }
  | { type: 'manual-failed'; error: SourceError; kind: RefreshFailureKind }
  | { type: 'visibility'; visible: boolean; now: number }
  | { type: 'stop'; reason: PollingStopReason };

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

export function initialPolling(offReason: PollingOffReason = 'not-started'): PollingState {
  return {
    phase: 'off',
    reason: null,
    offReason,
    inFlight: false,
    manualInFlight: false,
    nextDueAt: null,
    autoReadCount: 0,
  };
}

function stopped(reason: PollingStopReason, state: PollingState): PollingState {
  return {
    ...state,
    phase: 'stopped',
    reason,
    offReason: null,
    inFlight: false,
    manualInFlight: false,
    nextDueAt: null,
  };
}

function paused(reason: PollingStopReason, state: PollingState): PollingState {
  return {
    ...state,
    phase: 'paused',
    reason,
    offReason: null,
    inFlight: false,
    nextDueAt: null,
  };
}

function active(state: PollingState): PollingState {
  return {
    ...state,
    phase: 'active',
    reason: null,
    offReason: null,
    nextDueAt: null,
  };
}

export function stopReasonForError(error: SourceError): PollingStopReason {
  if (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_EXPIRED') {
    return 'auth';
  }
  if (error.code === 'FORBIDDEN') {
    return 'forbidden';
  }
  if (error.code === 'ORDER_NOT_FOUND') {
    return 'not-found';
  }
  return 'failed';
}

export function reducePolling(state: PollingState, event: PollingEvent): PollingState {
  switch (event.type) {
    case 'initial-succeeded':
      return isTerminalStatus(event.order.status)
        ? stopped('terminal', state)
        : active({ ...state, inFlight: false, manualInFlight: false });
    case 'initial-failed':
      return {
        ...initialPolling('initial-failed'),
        autoReadCount: state.autoReadCount,
      };
    case 'tick':
      if (state.phase !== 'active' || state.inFlight || state.manualInFlight) {
        return state;
      }
      return {
        ...state,
        inFlight: true,
        autoReadCount: state.autoReadCount + 1,
        nextDueAt: null,
      };
    case 'auto-succeeded':
      return isTerminalStatus(event.order.status)
        ? stopped('terminal', state)
        : active({ ...state, inFlight: false });
    case 'auto-failed': {
      const reason = stopReasonForError(event.error);
      return reason === 'failed'
        ? paused('failed', state)
        : stopped(reason, state);
    }
    case 'auto-dropped':
      return { ...state, inFlight: false };
    case 'manual-started':
      if (state.phase !== 'active' && state.phase !== 'paused') {
        return state;
      }
      return { ...state, manualInFlight: true, nextDueAt: null };
    case 'manual-succeeded':
      return isTerminalStatus(event.order.status)
        ? stopped('terminal', state)
        : active({ ...state, manualInFlight: false, inFlight: false });
    case 'manual-failed': {
      if (event.kind === 'terminal') {
        return stopped(stopReasonForError(event.error), state);
      }
      return paused('failed', { ...state, manualInFlight: false, inFlight: false });
    }
    case 'visibility': {
      if (event.visible) {
        if (state.phase === 'paused' && state.reason === 'hidden') {
          return {
            ...active({ ...state, inFlight: true }),
            autoReadCount: state.autoReadCount + 1,
          };
        }
        return state;
      }
      if (state.phase === 'active') {
        return paused('hidden', state);
      }
      return state;
    }
    case 'stop':
      return stopped(event.reason, state);
    default:
      return state;
  }
}

export interface VisibilitySource {
  isVisible(): boolean;
  subscribe(listener: (visible: boolean) => void): () => void;
}

export function createDocumentVisibility(): VisibilitySource {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return {
      isVisible: () => true,
      subscribe: () => () => {
        return;
      },
    };
  }
  return {
    isVisible: () => document.visibilityState !== 'hidden',
    subscribe(listener) {
      const handler = () => {
        listener(document.visibilityState !== 'hidden');
      };
      document.addEventListener('visibilitychange', handler);
      return () => {
        document.removeEventListener('visibilitychange', handler);
      };
    },
  };
}

export interface PollingSchedulerDeps {
  onRead: () => void;
  now?: () => number;
  setTimeoutFn?: (handler: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  isVisible?: () => boolean;
  onStateChange?: (state: PollingState) => void;
  intervalMs?: number;
}

export interface OrderPollingScheduler {
  getState(): PollingState;
  initialSucceeded(order: StudentOrder): void;
  initialFailed(): void;
  setVisible(visible: boolean): void;
  manualStarted(): void;
  manualSucceeded(order: StudentOrder): void;
  manualFailed(error: SourceError, kind: RefreshFailureKind): void;
  autoSucceeded(order: StudentOrder): void;
  autoFailed(error: SourceError): void;
  autoDropped(): void;
  stop(reason: PollingStopReason): void;
  dispose(): void;
}

export function createOrderPollingScheduler({
  onRead,
  now = () => Date.now(),
  setTimeoutFn = (handler, ms) => setTimeout(handler, ms),
  clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  isVisible = () => true,
  onStateChange,
  intervalMs = ORDER_POLL_INTERVAL_MS,
}: PollingSchedulerDeps): OrderPollingScheduler {
  let state = initialPolling();
  let timer: unknown = null;
  let disposed = false;

  function emit(next: PollingState): PollingState {
    state = next;
    if (onStateChange) {
      onStateChange({ ...state });
    }
    return state;
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function schedule(): void {
    clearTimer();
    if (disposed) {
      return;
    }
    if (state.phase !== 'active' || state.inFlight || state.manualInFlight) {
      return;
    }
    state = { ...state, nextDueAt: now() + intervalMs };
    timer = setTimeoutFn(() => {
      timer = null;
      tick();
    }, intervalMs);
  }

  function tick(): void {
    if (disposed) {
      return;
    }
    if (!isVisible()) {
      emit(paused('hidden', state));
      return;
    }
    if (state.phase !== 'active' || state.inFlight || state.manualInFlight) {
      return;
    }
    const next = reducePolling(state, { type: 'tick', now: now() });
    emit(next);
    if (next.inFlight) {
      onRead();
    }
  }

  function apply(event: PollingEvent, afterActive: 'schedule' | 'none' = 'schedule'): void {
    if (disposed) {
      return;
    }
    const next = reducePolling(state, event);
    const resumed = next.phase === 'active' && next.inFlight;
    emit(next);
    if (resumed) {
      onRead();
      return;
    }
    if (afterActive === 'schedule') {
      schedule();
    }
  }

  return {
    getState() {
      return { ...state };
    },

    initialSucceeded(order) {
      if (disposed) {
        return;
      }
      const next = reducePolling(state, { type: 'initial-succeeded', order, now: now() });
      if (next.phase === 'active' && !isVisible()) {
        emit(paused('hidden', next));
        return;
      }
      emit(next);
      schedule();
    },

    initialFailed() {
      if (disposed) {
        return;
      }
      emit(reducePolling(state, { type: 'initial-failed' }));
    },

    setVisible(visible) {
      if (disposed) {
        return;
      }
      if (!visible) {
        clearTimer();
      }
      const next = reducePolling(state, { type: 'visibility', visible, now: now() });
      const resumed = next.phase === 'active' && next.inFlight;
      emit(next);
      if (resumed) {
        onRead();
        return;
      }
      if (visible) {
        schedule();
      }
    },

    manualStarted() {
      if (disposed) {
        return;
      }
      clearTimer();
      emit(reducePolling(state, { type: 'manual-started' }));
    },

    manualSucceeded(order) {
      apply({ type: 'manual-succeeded', order, now: now() });
    },

    manualFailed(error, kind) {
      apply({ type: 'manual-failed', error, kind }, 'none');
    },

    autoSucceeded(order) {
      apply({ type: 'auto-succeeded', order, now: now() });
    },

    autoFailed(error) {
      apply({ type: 'auto-failed', error }, 'none');
    },

    autoDropped() {
      if (disposed) {
        return;
      }
      const next = reducePolling(state, { type: 'auto-dropped' });
      emit(next);
      if (next.phase === 'active') {
        schedule();
      }
    },

    stop(reason) {
      if (disposed) {
        return;
      }
      clearTimer();
      emit(reducePolling(state, { type: 'stop', reason }));
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      clearTimer();
      state = stopped('unmounted', state);
    },
  };
}