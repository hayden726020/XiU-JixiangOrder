import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  describeAuthError,
  validateStudentRegisterInput,
} from '../src/modules/student/utils/authView.ts';
import { ORDER_REMARK_MAX_LENGTH, sanitizeOrderRemark } from '../src/modules/student/utils/remark.ts';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

test('sanitizeOrderRemark trims control chars and caps remark at 50 chars', () => {
  assert.equal(ORDER_REMARK_MAX_LENGTH, 50);
  assert.equal(sanitizeOrderRemark('  不要辣\u0007，少放盐  '), '不要辣，少放盐');
  assert.equal(sanitizeOrderRemark('好'.repeat(60)).length, 50);
});

test('validateStudentRegisterInput validates 4-32 ASCII account and 8-128 password without trimming password spaces', () => {
  assert.equal(validateStudentRegisterInput('New_Student_01', '  valid-pass-123  '), null);
  assert.match(validateStudentRegisterInput('abc', 'valid-pass-123') ?? '', /4 到 32 位/);
  assert.match(validateStudentRegisterInput('bad name', 'valid-pass-123') ?? '', /4 到 32 位/);
  assert.match(validateStudentRegisterInput('stuKent', 'valid-pass-123') ?? '', /4 到 32 位/);
  assert.match(validateStudentRegisterInput('valid_user', 'short') ?? '', /8 到 128 位/);
  assert.match(validateStudentRegisterInput('valid_user', '        ') ?? '', /全为空格/);
});

test('describeAuthError maps ACCOUNT_TAKEN, RATE_LIMITED, VALIDATION_ERROR and UNAUTHENTICATED clearly', () => {
  assert.match(
    describeAuthError(
      { code: 'ACCOUNT_TAKEN', message: '账号已被使用。', status: 409, retryable: false },
      'register',
    ),
    /账号已被使用/,
  );
  assert.match(
    describeAuthError(
      { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试。', status: 429, retryable: true },
      'register',
    ),
    /频繁/,
  );
  assert.match(
    describeAuthError(
      { code: 'UNAUTHENTICATED', message: '账号或密码不正确。', status: 401, retryable: false },
      'login',
    ),
    /账号或密码不正确/,
  );
});

test('registerStudentAccount and login call /auth/student-register and /auth/login and persist student session', async () => {
  const prevWindow = globalThis.window;
  const prevFetch = globalThis.fetch;
  const requests = [];
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  globalThis.window = {
    location: { origin: 'https://39.96.195.158' },
    localStorage,
    sessionStorage,
    setTimeout,
    clearTimeout,
  };
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method, body: JSON.parse(init.body) });
    if (String(url).endsWith('/auth/student-register')) {
      return new Response(JSON.stringify({ data: { registered: true } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).endsWith('/auth/login')) {
      return new Response(
        JSON.stringify({
          data: {
            token: 'tok-student-real-1',
            tokenType: 'Bearer',
            expiresAt: '2099-01-01T00:00:00+08:00',
            user: {
              id: 'user_real_1',
              displayName: 'new_student_01',
              role: 'STUDENT',
              studentId: 'student_real_1',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    throw new Error(`Unexpected url: ${url}`);
  };

  const server = await createServer({
    configFile: false,
    root: mobileRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const auth = await server.ssrLoadModule('/src/shared/auth.ts');
    const sessionMod = await server.ssrLoadModule('/src/shared/session.ts');

    const reg = await auth.registerStudentAccount(' New_Student_01 ', 'student-pass-123');
    assert.deepEqual(reg, { registered: true });

    const loggedIn = await auth.login('New_Student_01', 'student-pass-123');
    assert.equal(loggedIn.user.role, 'STUDENT');
    assert.equal(loggedIn.user.displayName, 'new_student_01');
    assert.equal(sessionMod.getSession()?.token, 'tok-student-real-1');
    assert.ok(localStorage.getItem('xiu.mobile.session.v1'));

    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /\/api\/v1\/auth\/student-register$/);
    assert.deepEqual(requests[0].body, { account: 'New_Student_01', password: 'student-pass-123' });
    assert.match(requests[1].url, /\/api\/v1\/auth\/login$/);
    assert.deepEqual(requests[1].body, { account: 'New_Student_01', password: 'student-pass-123' });

    sessionMod.clearSession();
    assert.equal(localStorage.getItem('xiu.mobile.session.v1'), null);
  } finally {
    await server.close();
    globalThis.window = prevWindow;
    globalThis.fetch = prevFetch;
  }
});

test('LoginPage wires registration mode, login(), registerStudentAccount(), and sample mode fallback', () => {
  const loginPageSource = readFileSync(
    resolve(mobileRoot, 'src/modules/student/pages/LoginPage.tsx'),
    'utf8',
  );
  assert.match(loginPageSource, /registerStudentAccount\(/);
  assert.match(loginPageSource, /await login\(/);
  assert.match(loginPageSource, /mode === 'register'/);
  assert.match(loginPageSource, /onSwitchToSample/);
});
