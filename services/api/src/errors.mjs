export class ApiError extends Error {
  constructor(code, message, status = 400, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function validationError(message = '请求内容不符合要求。') {
  return new ApiError('VALIDATION_ERROR', message, 400, false);
}

export function unauthenticated(message = '请先登录。') {
  return new ApiError('UNAUTHENTICATED', message, 401, false);
}

export function sessionExpired(message = '登录已过期，请重新登录。') {
  return new ApiError('SESSION_EXPIRED', message, 401, false);
}

export function forbidden(message = '你无权执行此操作。') {
  return new ApiError('FORBIDDEN', message, 403, false);
}

export function notFound(code, message) {
  return new ApiError(code, message, 404, false);
}

export function conflict(code, message, retryable = false) {
  return new ApiError(code, message, 409, retryable);
}

export function unavailable(message = '服务暂不可用，请稍后重试。') {
  return new ApiError('SERVICE_UNAVAILABLE', message, 503, true);
}