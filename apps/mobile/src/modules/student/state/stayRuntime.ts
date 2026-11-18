export const STAY_THRESHOLD_MS = 10 * 60 * 1000;

export type StayPhase = 'disabled' | 'idle' | 'running' | 'paused' | 'triggered' | 'failed';

export interface StayState {
  phase: StayPhase;
  accumulatedMs: number;
}

export interface StayRuntimeOptions {
  mode: 'sample' | 'real';
  now?: () => number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  onThreshold?: () => void | Promise<void>;
  isVisible?: () => boolean;
  thresholdMs?: number;
}

export interface StayRuntime {
  getState(): StayState;
  subscribe(listener: (state: StayState) => void): () => void;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  markFailed(): void;
  dispose(): void;
}

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function clone(state: StayState): StayState {
  return { phase: state.phase, accumulatedMs: state.accumulatedMs };
}

export function createStayRuntime({
  mode,
  now = defaultNow,
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onThreshold,
  isVisible = () => true,
  thresholdMs = STAY_THRESHOLD_MS,
}: StayRuntimeOptions): StayRuntime {
  const listeners = new Set<(state: StayState) => void>();
  let state: StayState = {
    phase: mode === 'sample' ? 'disabled' : 'idle',
    accumulatedMs: 0,
  };
  let segmentStart = 0;
  let timer: unknown = null;
  let disposed = false;

  function emit(next: StayState): void {
    state = clone(next);
    for (const listener of listeners) {
      listener(clone(state));
    }
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function schedule(ms: number): void {
    clearTimer();
    timer = setTimeoutFn(() => {
      timer = null;
      tick();
    }, Math.max(1, ms));
  }

  function tick(): void {
    if (disposed || state.phase !== 'running') {
      return;
    }
    if (!isVisible()) {
      pause();
      return;
    }
    const elapsed = state.accumulatedMs + (now() - segmentStart);
    if (elapsed < thresholdMs) {
      schedule(thresholdMs - elapsed);
      return;
    }
    emit({ phase: 'triggered', accumulatedMs: thresholdMs });
    clearTimer();
    try {
      const result = onThreshold?.();
      if (result !== undefined && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch(() => markFailed());
      }
    } catch {
      markFailed();
    }
  }

  function start(): void {
    if (disposed || mode === 'sample') {
      return;
    }
    clearTimer();
    segmentStart = now();
    emit({ phase: 'running', accumulatedMs: 0 });
    schedule(thresholdMs);
  }

  function pause(): void {
    if (disposed || state.phase !== 'running') {
      return;
    }
    clearTimer();
    emit({
      phase: 'paused',
      accumulatedMs: state.accumulatedMs + (now() - segmentStart),
    });
  }

  function resume(): void {
    if (disposed || state.phase !== 'paused') {
      return;
    }
    segmentStart = now();
    emit({ phase: 'running', accumulatedMs: state.accumulatedMs });
    const remaining = thresholdMs - state.accumulatedMs;
    schedule(remaining <= 0 ? 1 : remaining);
  }

  function reset(): void {
    if (disposed || mode === 'sample') {
      return;
    }
    clearTimer();
    segmentStart = now();
    emit({ phase: 'running', accumulatedMs: 0 });
    schedule(thresholdMs);
  }

  function markFailed(): void {
    if (disposed) {
      return;
    }
    clearTimer();
    emit({ phase: 'failed', accumulatedMs: 0 });
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    clearTimer();
    listeners.clear();
  }

  return {
    getState(): StayState {
      return clone(state);
    },
    subscribe(listener: (state: StayState) => void): () => void {
      if (disposed) {
        return () => {};
      }
      listeners.add(listener);
      listener(clone(state));
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    pause,
    resume,
    reset,
    markFailed,
    dispose,
  };
}