import type { CrowdReference } from '../types';
import { isApiError } from '../types';

export interface SlotGuardError {
  code: string;
  message: string;
}

export interface SlotGuardState {
  currentSlotId: string | null;
  crowd: CrowdReference | null;
  error: SlotGuardError | null;
  loading: boolean;
}

export interface SlotSelectResult {
  discarded: boolean;
  reason?: string;
  data?: CrowdReference;
  error?: string;
}

export interface SlotRequestGuardOptions {
  fetchCrowd: (slotId: string) => Promise<CrowdReference>;
}

export interface SlotRequestGuard {
  selectSlot(slotId: string): Promise<SlotSelectResult>;
  getState(): SlotGuardState;
}

export function createSlotRequestGuard({ fetchCrowd }: SlotRequestGuardOptions): SlotRequestGuard {
  let seq = 0;
  let currentSlotId: string | null = null;
  let crowd: CrowdReference | null = null;
  let error: SlotGuardError | null = null;
  let loading = false;

  function snapshot(): SlotGuardState {
    return { currentSlotId, crowd, error, loading };
  }

  return {
    selectSlot(slotId: string): Promise<SlotSelectResult> {
      seq += 1;
      const mySeq = seq;
      currentSlotId = slotId;
      crowd = null;
      error = null;
      loading = true;

      const pending = Promise.resolve()
        .then(() => fetchCrowd(slotId))
        .then(
          (data): SlotSelectResult => {
            if (mySeq !== seq) {
              return { discarded: true, reason: 'stale-sequence' };
            }
            crowd = data;
            loading = false;
            error = null;
            return { discarded: false, data };
          },
          (failure: unknown): SlotSelectResult => {
            if (mySeq !== seq) {
              return { discarded: true, reason: 'stale-sequence' };
            }
            crowd = null;
            loading = false;
            error = {
              code: isApiError(failure) ? failure.code : 'CROWD_UNAVAILABLE',
              message: '信息不足，请以现场为准',
            };
            return { discarded: false, error: '信息不足，请以现场为准' };
          },
        );

      return pending;
    },
    getState: snapshot,
  };
}