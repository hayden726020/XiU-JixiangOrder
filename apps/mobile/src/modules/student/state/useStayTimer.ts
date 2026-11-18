import { useEffect, useRef, useState } from 'react';
import type { StudentMode } from '../types';
import { createDocumentVisibility } from './orderPolling';
import {
  createStayRuntime,
  type StayRuntime,
  type StayState,
} from './stayRuntime';

export interface UseStayTimerOptions {
  enabled: boolean;
  onThreshold: () => void | Promise<void>;
}

export interface UseStayTimerResult {
  state: StayState;
  reset: () => void;
  pause: () => void;
  resume: () => void;
  markFailed: () => void;
}

export function useStayTimer({
  enabled,
  onThreshold,
}: UseStayTimerOptions): UseStayTimerResult {
  const callbackRef = useRef(onThreshold);
  callbackRef.current = onThreshold;
  const mode: StudentMode = enabled ? 'real' : 'sample';
  const [runtime] = useState<StayRuntime>(() =>
    createStayRuntime({
      mode,
      onThreshold: () => callbackRef.current(),
      isVisible: () =>
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
    }),
  );
  const [state, setState] = useState<StayState>(() => runtime.getState());

  useEffect(() => runtime.subscribe(setState), [runtime]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    runtime.start();
    const visibility = createDocumentVisibility();
    const unsubscribe = visibility.subscribe((visible) => {
      if (visible) {
        runtime.resume();
      } else {
        runtime.pause();
      }
    });
    return () => {
      unsubscribe();
      runtime.dispose();
    };
  }, [runtime, enabled]);

  return {
    state,
    reset: runtime.reset,
    pause: runtime.pause,
    resume: runtime.resume,
    markFailed: runtime.markFailed,
  };
}