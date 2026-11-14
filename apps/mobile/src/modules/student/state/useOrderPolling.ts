import { useEffect, useRef, useState } from 'react';
import type { SourceError, StudentOrder } from '../types';
import type { RefreshFailureKind } from './orderRead';
import {
  createDocumentVisibility,
  createOrderPollingScheduler,
  initialPolling,
  type OrderPollingScheduler,
  type PollingOffReason,
  type PollingState,
  type PollingStopReason,
} from './orderPolling';

export interface OrderPollingHandle {
  state: PollingState;
  notifyInitialSuccess(order: StudentOrder): void;
  notifyInitialFailure(): void;
  notifyManualStart(): void;
  notifyManualSuccess(order: StudentOrder): void;
  notifyManualFailure(error: SourceError, kind: RefreshFailureKind): void;
  notifyAutoSuccess(order: StudentOrder): void;
  notifyAutoFailure(error: SourceError): void;
  notifyAutoDropped(): void;
  stop(reason: PollingStopReason): void;
}

export interface UseOrderPollingInput {
  enabled: boolean;
  offReason?: PollingOffReason;
  onAutoRead: () => void;
  onStateChange?: (state: PollingState) => void;
}

export function useOrderPolling({
  enabled,
  offReason = 'blocked',
  onAutoRead,
  onStateChange,
}: UseOrderPollingInput): OrderPollingHandle {
  const [state, setState] = useState<PollingState>(() =>
    initialPolling(enabled ? 'initial-reading' : offReason),
  );
  const schedulerRef = useRef<OrderPollingScheduler | null>(null);
  const readRef = useRef(onAutoRead);
  const changeRef = useRef(onStateChange);
  readRef.current = onAutoRead;
  changeRef.current = onStateChange;

  useEffect(() => {
    if (!enabled) {
      setState(initialPolling(offReason));
      if (changeRef.current) {
        changeRef.current(initialPolling(offReason));
      }
      return;
    }
    const visibility = createDocumentVisibility();
    const scheduler = createOrderPollingScheduler({
      onRead: () => readRef.current(),
      isVisible: () => visibility.isVisible(),
      onStateChange: (next) => {
        setState(next);
        if (changeRef.current) {
          changeRef.current(next);
        }
      },
    });
    schedulerRef.current = scheduler;
    const unsubscribe = visibility.subscribe((visible) => scheduler.setVisible(visible));
    setState(scheduler.getState());
    return () => {
      unsubscribe();
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, [enabled, offReason]);

  return {
    state,
    notifyInitialSuccess(order) {
      schedulerRef.current?.initialSucceeded(order);
    },
    notifyInitialFailure() {
      schedulerRef.current?.initialFailed();
    },
    notifyManualStart() {
      schedulerRef.current?.manualStarted();
    },
    notifyManualSuccess(order) {
      schedulerRef.current?.manualSucceeded(order);
    },
    notifyManualFailure(error, kind) {
      schedulerRef.current?.manualFailed(error, kind);
    },
    notifyAutoSuccess(order) {
      schedulerRef.current?.autoSucceeded(order);
    },
    notifyAutoFailure(error) {
      schedulerRef.current?.autoFailed(error);
    },
    notifyAutoDropped() {
      schedulerRef.current?.autoDropped();
    },
    stop(reason) {
      schedulerRef.current?.stop(reason);
    },
  };
}