import { buildApiUrl, getApiBaseInfo } from './config';
import { clearSession, getAccessToken } from './session';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: ApiMethod;
  body?: unknown;
  timeoutMs?: number;
  auth?: boolean;
}

export interface ApiErrorInit {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.retryable = init.retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fallbackCode(status: number): string {
  if (status === 401) {
    return 'UNAUTHENTICATED';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  if (status >= 500) {
    return 'SERVICE_UNAVAILABLE';
  }
  return 'HTTP_ERROR';
}

function readErrorPayload(payload: unknown, status: number): ApiErrorInit {
  if (isRecord(payload) && isRecord(payload.error)) {
    const error = payload.error;
    return {
      code: typeof error.code === 'string' ? error.code : fallbackCode(status),
      message: typeof error.message === 'string' ? error.message : '服务返回了未说明的错误。',
      status,
      retryable: error.retryable === true,
    };
  }
  return {
    code: fallbackCode(status),
    message: status >= 500 ? '服务暂不可用，请稍后重试原请求。' : '请求未被服务接受。',
    status,
    retryable: status >= 500,
  };
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = buildApiUrl(path);
  if (!url) {
    throw new ApiError({
      code: 'API_BASE_NOT_CONFIGURED',
      message: getApiBaseInfo().problem ?? '尚未配置服务地址。',
      status: 0,
      retryable: false,
    });
  }

  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: 'omit',
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError({
        code: 'NETWORK_TIMEOUT',
        message: '请求超时，写操作结果可能尚未确定；请用同一 requestId 恢复查询或重试。',
        status: 0,
        retryable: true,
      });
    }
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: '无法连接服务，请检查网络或服务地址。',
      status: 0,
      retryable: true,
    });
  } finally {
    window.clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await readPayload(response);
  } catch {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '服务响应无法读取。',
      status: response.status,
      retryable: response.status >= 500,
    });
  }

  if (!response.ok) {
    const error = readErrorPayload(payload, response.status);
    if (response.status === 401) {
      clearSession();
    }
    throw new ApiError(error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '服务响应缺少 data 字段。',
      status: response.status,
      retryable: false,
    });
  }

  return payload.data as T;
}