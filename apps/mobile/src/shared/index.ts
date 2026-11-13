export {
  buildApiUrl,
  clearStoredApiBaseUrl,
  getApiBaseInfo,
  getApiBaseUrl,
  isNativeApp,
  readStoredApiBaseUrl,
  saveStoredApiBaseUrl,
  type ApiBaseInfo,
} from './config';
export { ApiError, apiRequest, type ApiErrorInit, type ApiMethod, type ApiRequestOptions } from './apiClient';
export { RequestIdGuard, createRequestId } from './requestId';
export {
  clearSession,
  getAccessToken,
  getSession,
  roleLabel,
  saveSession,
  sessionIsExpired,
  subscribeSession,
  type Session,
  type SessionRole,
  type SessionUser,
} from './session';
export { demoLogin, loadSessionIdentity, logout, type SessionIdentity } from './auth';
export {
  DEMO_DINING_CONFIG,
  checkLocationPermission,
  checkPresenceOnce,
  clearPresence,
  evaluatePresence,
  fetchDiningConfig,
  reportPresence,
  requestLocationPermission,
  type DiningConfig,
  type LocationReport,
  type PermissionLabel,
  type Presence,
  type PresenceCheckResult,
  type PresenceReason,
} from './location';