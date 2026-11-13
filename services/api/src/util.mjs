import { createHash, randomUUID } from 'node:crypto';
import { ApiError, validationError } from './errors.mjs';

export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toShanghaiIso(epochMs) {
  const shifted = new Date(epochMs + SHANGHAI_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

export function shanghaiDate(epochMs) {
  return toShanghaiIso(epochMs).slice(0, 10);
}

export function addDays(dateString, days) {
  const start = Date.parse(`${dateString}T00:00:00+08:00`);
  return shanghaiDate(start + days * 24 * 60 * 60 * 1000);
}

export function dayStartMs(dateString) {
  return Date.parse(`${dateString}T00:00:00+08:00`);
}

export function newId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function requestHash(body) {
  const { requestId: _requestId, ...rest } = body ?? {};
  return sha256Hex(stableStringify(rest));
}

export function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('请求体必须是 JSON 对象。');
  }
  return value;
}

export function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') {
    throw validationError(`${field} 必须是字符串。`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw validationError(`${field} 长度应在 ${min} 到 ${max} 之间。`);
  }
  return trimmed;
}

export function requireInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw validationError(`${field} 必须是 ${min} 到 ${max} 之间的整数。`);
  }
  return value;
}

export function requireEnum(value, field, allowed) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw validationError(`${field} 必须是 ${allowed.join(' / ')} 之一。`);
  }
  return value;
}

export function requireOnlyFields(body, allowed) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      if (['latitude', 'longitude', 'coords', 'accuracy', 'position', 'userId', 'role'].includes(key)) {
        throw new ApiError('INVALID_LOCATION_PAYLOAD', '请求包含不允许的字段；服务端不接收精确坐标或身份字段。', 400, false);
      }
      throw validationError(`不支持的字段：${key}。`);
    }
  }
}

export function nowIso(clock) {
  return toShanghaiIso(clock());
}