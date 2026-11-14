import type {
  PermissionLabelKey,
  PresenceAdapter,
  PresenceOutcome,
  PresenceReasonKey,
} from '../data/presenceAdapter';

export type PresencePhase = 'idle' | 'loading' | 'inside' | 'outside' | 'unknown' | 'sample';

export interface PresenceState {
  phase: PresencePhase;
  reason: PresenceReasonKey;
  permission: PermissionLabelKey;
  checkedAt: string | null;
  expiresAt: string | null;
  messageKey: string;
  canRetry: boolean;
  canClear: boolean;
}

export interface PresenceController {
  getState(): PresenceState;
  startAuto(): Promise<PresenceState>;
  retry(): Promise<PresenceState>;
  clear(): Promise<PresenceState>;
  dispose(): void;
}

export interface PresenceControllerOptions {
  adapter: PresenceAdapter;
  timeoutMs?: number;
  now?: () => Date;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

const DEFAULT_TIMEOUT_MS = 3000;

function idleState(): PresenceState {
  return {
    phase: 'idle',
    reason: 'OK',
    permission: 'unknown',
    checkedAt: null,
    expiresAt: null,
    messageKey: 'idle',
    canRetry: true,
    canClear: false,
  };
}

export function createPresenceController({
  adapter,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => new Date(),
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: PresenceControllerOptions): PresenceController {
  let state: PresenceState = idleState();
  let autoStarted = false;
  let sequence = 0;
  let disposed = false;
  let pending: Promise<PresenceState> | null = null;

  function toState(outcome: PresenceOutcome): PresenceState {
    const isSample = outcome.reason === 'SAMPLE_MODE';
    const phase: PresencePhase =
      outcome.presence === 'INSIDE'
        ? 'inside'
        : outcome.presence === 'OUTSIDE'
          ? 'outside'
          : isSample
            ? 'sample'
            : 'unknown';
    return {
      phase,
      reason: outcome.reason,
      permission: outcome.permission,
      checkedAt: outcome.checkedAt,
      expiresAt: outcome.expiresAt,
      messageKey: phase,
      canRetry: !isSample,
      canClear: !isSample,
    };
  }

  function failureState(reason: PresenceReasonKey): PresenceState {
    return {
      phase: 'unknown',
      reason,
      permission: 'unknown',
      checkedAt: null,
      expiresAt: null,
      messageKey: 'unknown',
      canRetry: true,
      canClear: false,
    };
  }

  function expireIfNeeded(current: PresenceState): PresenceState {
    if (
      (current.phase === 'inside' || current.phase === 'outside') &&
      current.expiresAt !== null
    ) {
      const expiry = new Date(current.expiresAt).getTime();
      if (Number.isFinite(expiry) && now().getTime() > expiry) {
        return {
          ...current,
          phase: 'unknown',
          messageKey: 'unknown',
          canRetry: true,
        };
      }
    }
    return current;
  }

  function getState(): PresenceState {
    state = expireIfNeeded(state);
    return { ...state };
  }

  function request(): Promise<PresenceState> {
    const id = ++sequence;
    const startedAt = now();
    state = {
      phase: 'loading',
      reason: 'OK',
      permission: 'unknown',
      checkedAt: startedAt.toISOString(),
      expiresAt: null,
      messageKey: 'loading',
      canRetry: false,
      canClear: false,
    };

    const promise = new Promise<PresenceState>((resolve) => {
      let settled = false;
      const timer = setTimeoutFn(() => {
        if (settled || id !== sequence || disposed) {
          return;
        }
        settled = true;
        state = {
          phase: 'unknown',
          reason: 'TIMEOUT',
          permission: 'unknown',
          checkedAt: null,
          expiresAt: null,
          messageKey: 'unknown',
          canRetry: true,
          canClear: false,
        };
        resolve(getState());
      }, timeoutMs);

      adapter.checkOnce().then(
        (outcome) => {
          if (settled || id !== sequence || disposed) {
            return;
          }
          settled = true;
          clearTimeoutFn(timer);
          state = toState(outcome);
          resolve(getState());
        },
        () => {
          if (settled || id !== sequence || disposed) {
            return;
          }
          settled = true;
          clearTimeoutFn(timer);
          state = failureState('CAPABILITY_UNAVAILABLE');
          resolve(getState());
        },
      );
    });
    pending = promise;
    void promise.then(() => {
      if (pending === promise) {
        pending = null;
      }
    });
    return promise;
  }

  function startAuto(): Promise<PresenceState> {
    if (!autoStarted) {
      autoStarted = true;
      disposed = false;
      return request();
    }
    if (pending) {
      return pending;
    }
    if (disposed) {
      disposed = false;
      return request();
    }
    return Promise.resolve(getState());
  }

  return {
    getState,

    startAuto,

    retry(): Promise<PresenceState> {
      disposed = false;
      return request();
    },

    async clear(): Promise<PresenceState> {
      if (adapter.mode !== 'real') {
        sequence += 1;
        pending = null;
        state = {
          ...idleState(),
          messageKey: 'cleared',
          canRetry: false,
          canClear: false,
        };
        return getState();
      }
      try {
        await adapter.clear();
        sequence += 1;
        pending = null;
        state = { ...idleState(), messageKey: 'cleared' };
        return getState();
      } catch {
        state = failureState('CAPABILITY_UNAVAILABLE');
        return getState();
      }
    },

    dispose(): void {
      disposed = true;
      sequence += 1;
      pending = null;
    },
  };
}