import { Geolocation } from '@capacitor/geolocation';
import { ApiError, apiRequest } from './apiClient';

export type Presence = 'INSIDE' | 'OUTSIDE' | 'UNKNOWN';

export type PresenceReason =
  | 'OK'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_RESTRICTED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'ACCURACY_TOO_LOW'
  | 'BOUNDARY_UNCERTAIN';

export type PermissionLabel = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface DiningConfig {
  canteenId: string;
  name: string;
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  accuracyToleranceMeters: number;
  updatedAt: string;
  demo: boolean;
}

export interface PresenceCheckResult {
  presence: Presence;
  reason: PresenceReason;
  permission: PermissionLabel;
  demoConfig: boolean;
}

export interface LocationReport {
  presence: Presence;
  observedAt: string;
  expiresAt: string;
}

export const DEMO_DINING_CONFIG: DiningConfig = {
  canteenId: 'demo-canteen-01',
  name: '演示食堂（未现场核准）',
  center: { latitude: 30, longitude: 120 },
  radiusMeters: 150,
  accuracyToleranceMeters: 60,
  updatedAt: '2026-11-13T10:00:00+08:00',
  demo: true,
};

const EARTH_RADIUS_METERS = 6_371_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDiningConfig(value: unknown): DiningConfig | null {
  if (!isRecord(value) || !isRecord(value.center)) {
    return null;
  }
  const center = value.center;
  const latitude = center.latitude;
  const longitude = center.longitude;
  if (
    typeof value.canteenId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof value.radiusMeters !== 'number' ||
    value.radiusMeters <= 0 ||
    typeof value.accuracyToleranceMeters !== 'number' ||
    value.accuracyToleranceMeters < 0 ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }
  return {
    canteenId: value.canteenId,
    name: value.name,
    center: { latitude, longitude },
    radiusMeters: value.radiusMeters,
    accuracyToleranceMeters: value.accuracyToleranceMeters,
    updatedAt: value.updatedAt,
    demo: value.demo === true,
  };
}

export async function fetchDiningConfig(): Promise<DiningConfig> {
  const data = await apiRequest<unknown>('/dining/config');
  const config = parseDiningConfig(data);
  if (!config) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '食堂范围配置格式不正确，无法判断位置。',
      status: 0,
      retryable: false,
    });
  }
  return config;
}

function normalizePermission(value: unknown): PermissionLabel {
  if (value === 'granted' || value === 'denied' || value === 'prompt') {
    return value;
  }
  return 'unknown';
}

export async function checkLocationPermission(): Promise<PermissionLabel> {
  try {
    const status = await Geolocation.checkPermissions();
    return normalizePermission(status.location);
  } catch {
    return 'unknown';
  }
}

export async function requestLocationPermission(): Promise<PermissionLabel> {
  try {
    const status = await Geolocation.requestPermissions({ permissions: ['location'] });
    return normalizePermission(status.location);
  } catch {
    return 'unknown';
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function classifyPositionError(error: unknown): PresenceReason {
  if (isRecord(error) && typeof error.message === 'string') {
    const message = error.message.toLowerCase();
    if (message.includes('denied') || message.includes('authoriz')) {
      return 'PERMISSION_DENIED';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
  }
  return 'POSITION_UNAVAILABLE';
}

export function evaluatePresence(
  position: { latitude: number; longitude: number; accuracy: number },
  config: DiningConfig,
): { presence: Presence; reason: PresenceReason } {
  if (!Number.isFinite(position.accuracy) || position.accuracy <= 0) {
    return { presence: 'UNKNOWN', reason: 'ACCURACY_TOO_LOW' };
  }
  if (position.accuracy > config.accuracyToleranceMeters) {
    return { presence: 'UNKNOWN', reason: 'ACCURACY_TOO_LOW' };
  }
  const distance = distanceMeters(config.center, position);
  if (distance + position.accuracy <= config.radiusMeters) {
    return { presence: 'INSIDE', reason: 'OK' };
  }
  if (distance - position.accuracy >= config.radiusMeters) {
    return { presence: 'OUTSIDE', reason: 'OK' };
  }
  return { presence: 'UNKNOWN', reason: 'BOUNDARY_UNCERTAIN' };
}

export async function checkPresenceOnce(config: DiningConfig): Promise<PresenceCheckResult> {
  let permission = await checkLocationPermission();
  if (permission !== 'granted') {
    permission = await requestLocationPermission();
  }
  if (permission !== 'granted') {
    return {
      presence: 'UNKNOWN',
      reason: permission === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_RESTRICTED',
      permission,
      demoConfig: config.demo,
    };
  }

  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 0,
    });
    const result = evaluatePresence(
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
      config,
    );
    return { ...result, permission, demoConfig: config.demo };
  } catch (error) {
    return {
      presence: 'UNKNOWN',
      reason: classifyPositionError(error),
      permission,
      demoConfig: config.demo,
    };
  }
}

export async function reportPresence(presence: Presence, requestId: string): Promise<LocationReport> {
  const data = await apiRequest<unknown>('/me/location', {
    method: 'PUT',
    body: { requestId, presence },
  });
  if (!isRecord(data) || typeof data.observedAt !== 'string' || typeof data.expiresAt !== 'string') {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '位置判断响应格式不正确。',
      status: 0,
      retryable: false,
    });
  }
  return {
    presence,
    observedAt: data.observedAt,
    expiresAt: data.expiresAt,
  };
}

export async function clearPresence(): Promise<void> {
  await apiRequest<void>('/me/location', { method: 'DELETE' });
}