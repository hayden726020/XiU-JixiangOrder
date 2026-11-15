import type { LocationReport } from '../../../shared/location';
import { getSession, type Session } from '../../../shared/session';
import {
  createPresenceAdapter,
  type PermissionLabelKey,
  type PresenceAdapter,
  type PresenceOutcome,
  type PresenceReasonKey,
  type PresenceValue,
} from '../data/presenceAdapter';
import type { StudentMode } from '../types';
import { isApiError } from '../types';
import {
  buildPresenceFingerprint,
  createRequestIdKeeper,
  type RequestIdKeeper,
} from '../utils/requestId';
import { evaluateStudentSession, type StudentSessionGate } from './sessionGate';

export type PresencePhase =
  | 'idle'
  | 'loading'
  | 'inside'
  | 'outside'
  | 'unknown'
  | 'expired'
  | 'cleared'
  | 'sample';

export interface PresenceTiming {
  checkedAt: string | null;
  expiresAt: string | null;
  source: 'server' | 'local' | null;
}

export type PresenceSyncKind =
  | 'none'
  | 'not-signed-in'
  | 'pending'
  | 'synced'
  | 'failed'
  | 'conflict';

export interface PresenceSyncState {
  kind: PresenceSyncKind;
  requestId: string | null;
  messageKey: string;
  canRetrySync: boolean;
}

export interface PresenceState {
  phase: PresencePhase;
  reason: PresenceReasonKey | null;
  permission: PermissionLabelKey;
  demoConfig: boolean;
  timing: PresenceTiming;
  messageKey: string;
  sync: PresenceSyncState;
  clearing: 'idle' | 'pending' | 'failed';
  canLocate: boolean;
  canClear: boolean;
  busy: boolean;
  canRetry: boolean;
  checkedAt: string | null;
  expiresAt: string | null;
}

export const LOCATE_TIMEOUT_MS = 12_000;
const LOCATION_REQUEST_PREFIX = 'loc-req';

export interface PresenceRuntimeOptions {
  adapter: PresenceAdapter;
  mode: StudentMode;
  now?: () => Date;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  getSession?: () => Session | null;
  gate?: (session: Session | null, now: Date) => StudentSessionGate;
  reporter?: (presence: PresenceValue, requestId: string) => Promise<LocationReport>;
  clearer?: () => Promise<void>;
  requestIds?: RequestIdKeeper;
  timeoutMs?: number;
}

export interface PresenceRuntime {
  getState(): PresenceState;
  subscribe(listener: (state: PresenceState) => void): () => void;
  enter(): Promise<PresenceState>;
  leave(): void;
  locate(): Promise<PresenceState>;
  retrySync(): Promise<PresenceState>;
  clear(): Promise<PresenceState>;
  dispose(): void;
}

function emptyTiming(): PresenceTiming {
  return { checkedAt: null, expiresAt: null, source: null };
}

function noneSync(): PresenceSyncState {
  return { kind: 'none', requestId: null, messageKey: 'sync-none', canRetrySync: false };
}

function initialState(mode: StudentMode): PresenceState {
  const phase: PresencePhase = mode === 'real' ? 'idle' : 'sample';
  const usable = mode === 'real';
  return {
    phase,
    reason: null,
    permission: 'unknown',
    demoConfig: false,
    timing: emptyTiming(),
    messageKey: phase,
    sync: noneSync(),
    clearing: 'idle',
    canLocate: usable,
    canClear: usable,
    busy: false,
    canRetry: usable,
    checkedAt: null,
    expiresAt: null,
  };
}

function cloneState(state: PresenceState): PresenceState {
  return {
    ...state,
    timing: { ...state.timing },
    sync: { ...state.sync },
  };
}

function presenceOfPhase(phase: PresencePhase): PresenceValue | null {
  if (phase === 'inside') {
    return 'INSIDE';
  }
  if (phase === 'outside') {
    return 'OUTSIDE';
  }
  if (phase === 'unknown') {
    return 'UNKNOWN';
  }
  return null;
}

function shouldReport(reason: PresenceReasonKey): boolean {
  return (
    reason !== 'PERMISSION_DENIED' &&
    reason !== 'PERMISSION_RESTRICTED' &&
    reason !== 'CONFIG_UNAVAILABLE' &&
    reason !== 'CAPABILITY_UNAVAILABLE' &&
    reason !== 'SAMPLE_MODE'
  );
}

export function createPresenceRuntime({
  adapter,
  mode,
  now = () => new Date(),
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  getSession: readSession = getSession,
  gate = evaluateStudentSession,
  reporter,
  clearer,
  requestIds,
  timeoutMs = LOCATE_TIMEOUT_MS,
}: PresenceRuntimeOptions): PresenceRuntime {
  const keeper = requestIds ?? createRequestIdKeeper({ prefix: LOCATION_REQUEST_PREFIX });
  const adapterReport = (adapter as Partial<PresenceAdapter>).report;
  const send =
    reporter ??
    (typeof adapterReport === 'function'
      ? (presence: PresenceValue, requestId: string) => adapterReport.call(adapter, presence, requestId)
      : null);
  const remove = clearer ?? (() => adapter.clear());

  let state: PresenceState = initialState(mode);
  let sequence = 0;
  let pending: Promise<PresenceState> | null = null;
  let disposed = false;
  let expiryTimer: unknown = null;
  const subscribers = new Set<(next: PresenceState) => void>();

  function canWrite(): boolean {
    return mode === 'real';
  }

  function merge(patch: Partial<PresenceState>): PresenceState {
    const next: PresenceState = { ...state, ...patch };
    const writePending = next.sync.kind === 'pending' || next.clearing === 'pending';
    const loading = next.phase === 'loading';
    const usable = canWrite() && !loading && next.phase !== 'sample' && !writePending;
    next.canLocate = usable;
    next.canClear = usable;
    next.canRetry = usable;
    next.busy = loading || writePending;
    next.checkedAt = next.timing.checkedAt;
    next.expiresAt = next.timing.expiresAt;
    return next;
  }

  function notify(): void {
    const snapshot = cloneState(state);
    subscribers.forEach((listener) => listener(snapshot));
  }

  function commit(patch: Partial<PresenceState>): void {
    state = merge(patch);
    notify();
  }

  function clearExpiry(): void {
    if (expiryTimer !== null) {
      clearTimeoutFn(expiryTimer);
      expiryTimer = null;
    }
  }

  function scheduleExpiry(expiresAt: string | null, forSequence: number): void {
    clearExpiry();
    if (expiresAt === null) {
      return;
    }
    const expiry = Date.parse(expiresAt);
    if (!Number.isFinite(expiry)) {
      return;
    }
    const delay = Math.max(0, Math.min(expiry - now().getTime(), 24 * 60 * 60 * 1000));
    expiryTimer = setTimeoutFn(() => {
      expiryTimer = null;
      if (disposed || forSequence !== sequence) {
        return;
      }
      if (state.phase === 'inside' || state.phase === 'outside' || state.phase === 'unknown') {
        commit({ phase: 'expired', messageKey: 'expired' });
      }
    }, delay);
  }

  function getState(): PresenceState {
    if (
      (state.phase === 'inside' || state.phase === 'outside' || state.phase === 'unknown') &&
      state.timing.expiresAt !== null
    ) {
      const expiry = Date.parse(state.timing.expiresAt);
      if (Number.isFinite(expiry) && now().getTime() > expiry) {
        state = merge({ phase: 'expired', messageKey: 'expired' });
      }
    }
    return cloneState(state);
  }

  function isAuthError(error: unknown): boolean {
    if (!isApiError(error)) {
      return false;
    }
    return error.status === 401 || error.status === 403 || error.code === 'UNAUTHENTICATED';
  }

  function isConflictError(error: unknown): boolean {
    if (!isApiError(error)) {
      return false;
    }
    return error.status === 409 || error.code === 'REQUEST_CONFLICT';
  }

  async function sendReport(
    presence: PresenceValue,
    requestId: string,
    forSequence: number,
    allowConflictRetry: boolean,
  ): Promise<PresenceSyncKind> {
    if (send === null) {
      return 'none';
    }
    commit({ sync: { kind: 'pending', requestId, messageKey: 'sync-pending', canRetrySync: false } });
    try {
      const report = await send(presence, requestId);
      if (disposed || forSequence !== sequence) {
        return state.sync.kind;
      }
      keeper.complete();
      const expired = (() => {
        const expiry = Date.parse(report.expiresAt);
        return Number.isFinite(expiry) && now().getTime() > expiry;
      })();
      commit({
        phase: expired ? 'expired' : state.phase,
        messageKey: expired ? 'expired' : state.messageKey,
        timing: {
          checkedAt: report.observedAt,
          expiresAt: report.expiresAt,
          source: 'server',
        },
        sync: { kind: 'synced', requestId: null, messageKey: 'sync-synced', canRetrySync: false },
      });
      scheduleExpiry(report.expiresAt, forSequence);
      return 'synced';
    } catch (error) {
      if (disposed || forSequence !== sequence) {
        return state.sync.kind;
      }
      if (isAuthError(error)) {
        commit({
          sync: {
            kind: 'not-signed-in',
            requestId,
            messageKey: 'sync-login-expired',
            canRetrySync: false,
          },
        });
        return 'not-signed-in';
      }
      if (isConflictError(error)) {
        if (allowConflictRetry) {
          keeper.complete();
          const nextRequestId = keeper.ensure(
            buildPresenceFingerprint(presence, state.timing.checkedAt ?? now().toISOString()),
          );
          return sendReport(presence, nextRequestId, forSequence, false);
        }
        commit({
          sync: { kind: 'conflict', requestId, messageKey: 'sync-conflict', canRetrySync: true },
        });
        return 'conflict';
      }
      commit({
        sync: { kind: 'failed', requestId, messageKey: 'sync-failed', canRetrySync: true },
      });
      return 'failed';
    }
  }

  async function applyOutcome(outcome: PresenceOutcome, forSequence: number): Promise<void> {
    if (disposed || forSequence !== sequence) {
      return;
    }
    const phase: PresencePhase =
      outcome.presence === 'INSIDE'
        ? 'inside'
        : outcome.presence === 'OUTSIDE'
          ? 'outside'
          : 'unknown';
    commit({
      phase,
      reason: outcome.reason,
      permission: outcome.permission,
      demoConfig: outcome.demoConfig === true,
      timing: {
        checkedAt: outcome.checkedAt,
        expiresAt: outcome.expiresAt,
        source: 'local',
      },
      messageKey: phase,
      clearing: 'idle',
      sync: noneSync(),
    });
    scheduleExpiry(outcome.expiresAt, forSequence);
    if (subscribers.size === 0 || !shouldReport(outcome.reason)) {
      return;
    }
    const checkedAt = outcome.checkedAt ?? now().toISOString();
    const requestId = keeper.ensure(buildPresenceFingerprint(outcome.presence, checkedAt));
    const gateResult = gate(readSession(), now());
    if (!gateResult.usable) {
      commit({
        sync: { kind: 'not-signed-in', requestId, messageKey: 'sync-login', canRetrySync: false },
      });
      return;
    }
    await sendReport(outcome.presence, requestId, forSequence, true);
  }

  function beginLocate(): Promise<PresenceState> {
    sequence += 1;
    const forSequence = sequence;
    keeper.complete();
    clearExpiry();
    commit({
      phase: 'loading',
      reason: null,
      permission: 'unknown',
      demoConfig: false,
      timing: emptyTiming(),
      messageKey: 'loading',
      clearing: 'idle',
      sync: noneSync(),
    });

    const promise = new Promise<PresenceState>((resolve) => {
      let settled = false;
      const timer = setTimeoutFn(() => {
        if (settled) {
          return;
        }
        settled = true;
        if (disposed || forSequence !== sequence) {
          resolve(getState());
          return;
        }
        const timedOutAt = now();
        void applyOutcome(
          {
            presence: 'UNKNOWN',
            reason: 'TIMEOUT',
            permission: 'unknown',
            demoConfig: false,
            checkedAt: timedOutAt.toISOString(),
            expiresAt: new Date(timedOutAt.getTime() + 10 * 60 * 1000).toISOString(),
          },
          forSequence,
        ).then(() => resolve(getState()));
      }, timeoutMs);

      adapter.checkOnce().then(
        (outcome) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeoutFn(timer);
          if (disposed || forSequence !== sequence) {
            resolve(getState());
            return;
          }
          void applyOutcome(outcome, forSequence).then(() => resolve(getState()));
        },
        () => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeoutFn(timer);
          if (disposed || forSequence !== sequence) {
            resolve(getState());
            return;
          }
          void applyOutcome(
            {
              presence: 'UNKNOWN',
              reason: 'CAPABILITY_UNAVAILABLE',
              permission: 'unknown',
              demoConfig: false,
              checkedAt: now().toISOString(),
              expiresAt: null,
            },
            forSequence,
          ).then(() => resolve(getState()));
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

  function enter(): Promise<PresenceState> {
    if (!canWrite()) {
      return Promise.resolve(getState());
    }
    if (pending !== null) {
      return pending;
    }
    const current = getState();
    if (current.phase === 'loading') {
      return Promise.resolve(current);
    }
    if (current.phase === 'cleared') {
      return Promise.resolve(current);
    }
    if (current.phase === 'inside' || current.phase === 'outside') {
      return Promise.resolve(current);
    }
    if (current.phase === 'unknown') {
      return Promise.resolve(current);
    }
    return beginLocate();
  }

  function locate(): Promise<PresenceState> {
    if (!canWrite()) {
      return Promise.resolve(getState());
    }
    if (pending !== null) {
      return pending;
    }
    if (state.phase === 'loading' || state.sync.kind === 'pending' || state.clearing === 'pending') {
      return Promise.resolve(getState());
    }
    return beginLocate();
  }

  function retrySync(): Promise<PresenceState> {
    if (!canWrite()) {
      return Promise.resolve(getState());
    }
    const current = getState();
    if (pending !== null) {
      return pending;
    }
    if (
      current.sync.requestId === null ||
      (current.sync.kind !== 'failed' && current.sync.kind !== 'conflict') ||
      current.clearing === 'pending'
    ) {
      return Promise.resolve(current);
    }
    const presence = presenceOfPhase(current.phase);
    if (presence === null) {
      return Promise.resolve(current);
    }
    const requestId = current.sync.requestId;
    const promise = sendReport(presence, requestId, sequence, false).then(() => getState());
    pending = promise;
    void promise.then(() => {
      if (pending === promise) {
        pending = null;
      }
    });
    return promise;
  }

  function clear(): Promise<PresenceState> {
    if (!canWrite()) {
      return Promise.resolve(getState());
    }
    if (
      pending !== null ||
      state.sync.kind === 'pending' ||
      state.clearing === 'pending'
    ) {
      return pending ?? Promise.resolve(getState());
    }
    sequence += 1;
    clearExpiry();
    commit({ clearing: 'pending' });

    const promise = remove().then(
      () => {
        if (disposed) {
          return getState();
        }
        sequence += 1;
        keeper.complete();
        commit({
          phase: 'cleared',
          reason: null,
          permission: 'unknown',
          demoConfig: false,
          timing: emptyTiming(),
          messageKey: 'cleared',
          clearing: 'idle',
          sync: noneSync(),
        });
        return getState();
      },
      () => {
        if (disposed) {
          return getState();
        }
        commit({ clearing: 'failed' });
        return getState();
      },
    );
    pending = promise;
    void promise.then(() => {
      if (pending === promise) {
        pending = null;
      }
    });
    return promise;
  }

  return {
    getState,

    subscribe(listener) {
      subscribers.add(listener);
      listener(cloneState(getState()));
      return () => {
        subscribers.delete(listener);
      };
    },

    enter,

    leave() {
      return;
    },

    locate,

    retrySync,

    clear,

    dispose() {
      disposed = true;
      sequence += 1;
      pending = null;
      clearExpiry();
      subscribers.clear();
    },
  };
}

const runtimes = new Map<StudentMode, PresenceRuntime>();

export function getPresenceRuntime(mode: StudentMode): PresenceRuntime {
  const existing = runtimes.get(mode);
  if (existing !== undefined) {
    return existing;
  }
  const runtime = createPresenceRuntime({
    adapter: createPresenceAdapter({ mode }),
    mode,
  });
  runtimes.set(mode, runtime);
  return runtime;
}