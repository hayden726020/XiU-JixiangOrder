import {
  LOCATE_TIMEOUT_MS,
  createPresenceRuntime,
  type PresenceRuntimeOptions,
  type PresenceState,
} from './presenceRuntime';
import type { PresenceAdapter } from '../data/presenceAdapter';

export type {
  PresencePhase,
  PresenceState,
  PresenceSyncKind,
  PresenceSyncState,
  PresenceTiming,
} from './presenceRuntime';
export { LOCATE_TIMEOUT_MS } from './presenceRuntime';

export interface PresenceController {
  getState(): PresenceState;
  subscribe(listener: (state: PresenceState) => void): () => void;
  startAuto(): Promise<PresenceState>;
  retry(): Promise<PresenceState>;
  retrySync(): Promise<PresenceState>;
  clear(): Promise<PresenceState>;
  dispose(): void;
}

export interface PresenceControllerOptions extends Partial<PresenceRuntimeOptions> {
  adapter: PresenceAdapter;
  timeoutMs?: number;
}

export function createPresenceController(
  options: PresenceControllerOptions,
): PresenceController {
  const { adapter, mode, timeoutMs = LOCATE_TIMEOUT_MS, ...rest } = options;
  const runtime = createPresenceRuntime({
    ...rest,
    adapter,
    mode: mode ?? adapter.mode,
    timeoutMs,
  });
  return {
    getState: runtime.getState,
    subscribe: runtime.subscribe,
    startAuto: runtime.enter,
    retry: runtime.locate,
    retrySync: runtime.retrySync,
    clear: runtime.clear,
    dispose: runtime.dispose,
  };
}