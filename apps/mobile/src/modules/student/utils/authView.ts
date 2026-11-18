export type StudentAuthMode = 'login' | 'register';

const ACCOUNT_PATTERN = /^[A-Za-z0-9_]{4,32}$/;

function isApiErrorLike(
  error: unknown,
): error is { code: string; message: string; status?: number; retryable?: boolean } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

export function validateStudentRegisterInput(account: string, password: string): string | null {
  const trimmedAccount = account.trim();
  if (!ACCOUNT_PATTERN.test(trimmedAccount)) {
    return '账号应为 4 到 32 位英文字母、数字或下划线。';
  }
  if (password.length < 8 || password.length > 128) {
    return '密码长度应为 8 到 128 位。';
  }
  if (password.trim().length === 0) {
    return '密码不能全为空格。';
  }
  return null;
}

export function describeAuthError(error: unknown, mode: StudentAuthMode): string {
  if (!isApiErrorLike(error)) {
    return mode === 'register' ? '注册未完成，请稍后重试。' : '登录未完成，请稍后重试。';
  }
  switch (error.code) {
    case 'ACCOUNT_TAKEN':
      return '该账号已被使用，请更换其他账号。';
    case 'VALIDATION_ERROR':
      return error.message || '输入格式不符合要求，请核对账号与密码。';
    case 'RATE_LIMITED':
      return '操作过于频繁，请稍后再试。';
    case 'UNAUTHENTICATED':
      return '账号或密码不正确，请核对后重试。';
    case 'API_BASE_NOT_CONFIGURED':
      return `${mode === 'register' ? '注册' : '登录'}服务地址尚未配置：${error.message}`;
    case 'NETWORK_ERROR':
    case 'NETWORK_TIMEOUT':
    case 'NOT_FOUND':
    case 'HTTP_ERROR':
      return `${error.message} 请先在「公共能力自检」里确认服务地址是否可用。`;
    default:
      return `${error.message}（${error.code}）`;
  }
}
