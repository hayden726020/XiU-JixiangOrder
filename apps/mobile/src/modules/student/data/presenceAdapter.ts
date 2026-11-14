import type { LocationReport } from '../../../shared/location';


export type PresenceValue = 'INSIDE' | 'OUTSIDE' | 'UNKNOWN';

export type PresenceReasonKey =
  | 'OK'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_RESTRICTED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'ACCURACY_TOO_LOW'
  | 'BOUNDARY_UNCERTAIN'
  | 'CONFIG_UNAVAILABLE'
  | 'CAPABILITY_UNAVAILABLE'
  | 'SAMPLE_MODE';

export type PermissionLabelKey = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface PresenceOutcome {
  presence: PresenceValue;
  reason: PresenceReasonKey;
  permission: PermissionLabelKey;
  demoConfig: boolean;
  checkedAt: string | null;
  expiresAt: string | null;
}

export interface PresenceAdapter {
  readonly mode: 'sample' | 'real';
  checkOnce(): Promise<PresenceOutcome>;
  report(presence: PresenceValue, requestId: string): Promise<LocationReport>;
  clear(): Promise<void>;
}

export interface PresenceAdapterOptions {
  mode: 'sample' | 'real';
  now?: () => Date;
}

export const PRESENCE_TTL_MS = 10 * 60 * 1000;

function sampleOutcome(): PresenceOutcome {
  return {
    presence: 'UNKNOWN',
    reason: 'SAMPLE_MODE',
    permission: 'unknown',
    demoConfig: false,
    checkedAt: null,
    expiresAt: null,
  };
}

function unavailableOutcome(reason: PresenceReasonKey): PresenceOutcome {
  return {
    presence: 'UNKNOWN',
    reason,
    permission: 'unknown',
    demoConfig: false,
    checkedAt: null,
    expiresAt: null,
  };
}

export function createPresenceAdapter({
  mode,
  now = () => new Date(),
}: PresenceAdapterOptions): PresenceAdapter {

  return {
    mode,

    async checkOnce(): Promise<PresenceOutcome> {
      if (mode !== 'real') {
        return sampleOutcome();
      }
      const { fetchDiningConfig, checkPresenceOnce } = await import('../../../shared/location');
      let config;
      try {
        config = await fetchDiningConfig();
      } catch {
        return unavailableOutcome('CONFIG_UNAVAILABLE');
      }
      let result;
      try {
        result = await checkPresenceOnce(config);
      } catch {
        return unavailableOutcome('CAPABILITY_UNAVAILABLE');
      }
      const checkedAt = now();
      return {
        presence: result.presence,
        reason: result.reason,
        permission: result.permission,
        demoConfig: result.demoConfig === true,
        checkedAt: checkedAt.toISOString(),
        expiresAt: new Date(checkedAt.getTime() + PRESENCE_TTL_MS).toISOString(),
      };
    },

    async report(presence: PresenceValue, requestId: string): Promise<LocationReport> {
      if (mode !== 'real') {
        const at = now();
        return {
          presence,
          observedAt: at.toISOString(),
          expiresAt: new Date(at.getTime() + PRESENCE_TTL_MS).toISOString(),
        };
      }
      const { reportPresence } = await import('../../../shared/location');
      return reportPresence(presence, requestId);
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