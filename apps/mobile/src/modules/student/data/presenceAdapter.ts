import { createRequestIdKeeper } from '../utils/requestId';

export type PresenceValue = 'INSIDE' | 'OUTSIDE' | 'UNKNOWN';

export type PresenceReasonKey =
  | 'OK'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_RESTRICTED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'ACCURACY_TOO_LOW'
  | 'BOUNDARY_UNCERTAIN'
  | 'SAMPLE_MODE'
  | 'CAPABILITY_UNAVAILABLE';

export type PermissionLabelKey = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface PresenceOutcome {
  presence: PresenceValue;
  reason: PresenceReasonKey;
  permission: PermissionLabelKey;
  checkedAt: string | null;
  expiresAt: string | null;
}

export interface PresenceAdapter {
  readonly mode: 'sample' | 'real';
  checkOnce(): Promise<PresenceOutcome>;
  clear(): Promise<void>;
}

export interface PresenceAdapterOptions {
  mode: 'sample' | 'real';
  now?: () => Date;
}

const PRESENCE_TTL_MS = 10 * 60 * 1000;
const LOCATION_REQUEST_PREFIX = 'loc-req';
const LOCATION_FINGERPRINT = {
  date: null,
  items: [],
  slotId: null,
  diningMode: null,
};

function sampleOutcome(): PresenceOutcome {
  return {
    presence: 'UNKNOWN',
    reason: 'SAMPLE_MODE',
    permission: 'unknown',
    checkedAt: null,
    expiresAt: null,
  };
}

function unavailableOutcome(reason: PresenceReasonKey): PresenceOutcome {
  return {
    presence: 'UNKNOWN',
    reason,
    permission: 'unknown',
    checkedAt: null,
    expiresAt: null,
  };
}

export function createPresenceAdapter({
  mode,
  now = () => new Date(),
}: PresenceAdapterOptions): PresenceAdapter {
  const requestIds = createRequestIdKeeper({ prefix: LOCATION_REQUEST_PREFIX });

  async function reportOnce(presence: PresenceValue): Promise<void> {
    const { reportPresence } = await import('../../../shared/location');
    requestIds.complete();
    const requestId = requestIds.ensure(LOCATION_FINGERPRINT);
    await reportPresence(presence, requestId);
  }

  return {
    mode,

    async checkOnce(): Promise<PresenceOutcome> {
      if (mode !== 'real') {
        return sampleOutcome();
      }
      try {
        const { fetchDiningConfig, checkPresenceOnce } = await import('../../../shared/location');
        const config = await fetchDiningConfig();
        const result = await checkPresenceOnce(config);
        const checkedAt = now();
        const outcome: PresenceOutcome = {
          presence: result.presence,
          reason: result.reason,
          permission: result.permission,
          checkedAt: checkedAt.toISOString(),
          expiresAt: new Date(checkedAt.getTime() + PRESENCE_TTL_MS).toISOString(),
        };
        try {
          await reportOnce(result.presence);
        } catch {
          return outcome;
        }
        return outcome;
      } catch {
        return unavailableOutcome('CAPABILITY_UNAVAILABLE');
      }
    },

    async clear(): Promise<void> {
      if (mode !== 'real') {
        return;
      }
      const { clearPresence } = await import('../../../shared/location');
      await clearPresence();
    },
  };
}