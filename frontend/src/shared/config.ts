import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'xiu.mobile.apiBaseUrl.v1';
const BROWSER_DEFAULT = '/api/v1';

export interface ApiBaseInfo {
  baseUrl: string | null;
  source: 'env' | 'local' | 'browser-default' | 'none';
  problem: string | null;
}

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function readStoredApiBaseUrl(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredApiBaseUrl(value: string): void {
  window.localStorage.setItem(STORAGE_KEY, value.trim());
}

export function clearStoredApiBaseUrl(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getApiBaseInfo(): ApiBaseInfo {
  const native = isNativeApp();
  const stored = readStoredApiBaseUrl();
  const fromEnv = import.meta.env.VITE_API_BASE_URL;

  const candidates: Array<{ value: string | undefined; source: ApiBaseInfo['source'] }> = [
    { value: stored ?? undefined, source: 'local' },
    { value: fromEnv, source: 'env' },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) {
      continue;
    }
    const normalized = normalizeBaseUrl(candidate.value);
    if (!normalized) {
      return {
        baseUrl: null,
        source: candidate.source,
        problem: '服务地址格式无效，应为 http(s) 地址。',
      };
    }
    if (native && isLoopbackHost(new URL(normalized).hostname)) {
      return {
        baseUrl: null,
        source: candidate.source,
        problem: '真机不能使用 localhost 或 127.0.0.1，请配置手机可访问的服务地址。',
      };
    }
    return { baseUrl: normalized, source: candidate.source, problem: null };
  }

  if (native) {
    return {
      baseUrl: null,
      source: 'none',
      problem: '尚未配置公共测试服务地址，真机无法连接。',
    };
  }

  return { baseUrl: BROWSER_DEFAULT, source: 'browser-default', problem: null };
}

export function getApiBaseUrl(): string | null {
  return getApiBaseInfo().baseUrl;
}

export function buildApiUrl(path: string): string | null {
  const base = getApiBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}