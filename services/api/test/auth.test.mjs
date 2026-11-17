import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createAuthRateLimiter } from '../src/auth-rate-limit.mjs';
import { startTestServer } from './helpers.mjs';

let ctx;

before(async () => {
  ctx = await startTestServer();
});

after(async () => {
  await ctx.close();
});

test('health 返回服务信息，不要求登录', async () => {
  const response = await ctx.api('GET', '/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.service, 'xiu-jixiang-order-api');
});

test('未登录访问 /me 返回 401 UNAUTHENTICATED', async () => {
  const response = await ctx.api('GET', '/me');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('错误密码不签发令牌', async () => {
  const response = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'demo-student', password: 'wrong-password' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  assert.equal(response.body.data, undefined);
});

test('演示登录返回服务端角色与会话', async () => {
  const student = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'demo-student', password: 'student-pass-123' },
  });
  assert.equal(student.status, 200);
  assert.equal(student.body.data.user.role, 'STUDENT');
  assert.equal(student.body.data.user.studentId, 'demo-student-01');
  assert.equal(student.body.data.tokenType, 'Bearer');

  const admin = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'demo-admin', password: 'admin-pass-123' },
  });
  assert.equal(admin.body.data.user.role, 'ADMIN');
});

test('开放注册只保存学生账号，随后用通用登录获取会话', async () => {
  const registered = await ctx.api('POST', '/auth/student-register', {
    body: { account: 'New_Student_01', password: 'student-secret-123' },
  });
  assert.equal(registered.status, 201);
  assert.deepEqual(registered.body, { data: { registered: true } });
  const stored = ctx.db.prepare('SELECT * FROM users WHERE account = ?').get('new_student_01');
  assert.equal(stored.role, 'STUDENT');
  assert.equal(stored.display_name, 'new_student_01');
  assert.match(stored.student_id, /^student_/);
  assert.notEqual(stored.password_stored, 'student-secret-123');

  const loggedIn = await ctx.api('POST', '/auth/login', {
    body: { account: 'NEW_STUDENT_01', password: 'student-secret-123' },
  });
  assert.equal(loggedIn.status, 200);
  assert.equal(loggedIn.body.data.user.role, 'STUDENT');
  assert.equal(loggedIn.body.data.user.studentId, stored.student_id);
  const me = await ctx.api('GET', '/me', { token: loggedIn.body.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.id, stored.id);
});

test('注册拒绝重名、越权字段和不合规账号密码', async () => {
  ctx.addUser({
    id: 'registered-merchant-user',
    account: 'merchant_existing',
    password: 'merchant-secret-123',
    role: 'MERCHANT',
    displayName: 'Existing merchant',
  });
  const invalidBodies = [
    { account: 'merchant_existing', password: 'student-secret-123' },
    { account: 'new_student_01', password: 'another-secret-123' },
    { account: 'bad name', password: 'student-secret-123' },
    { account: 'abc', password: 'student-secret-123' },
    { account: 'new_student_02', password: 'short' },
    { account: 'new_student_02', password: 'student-secret-123', role: 'ADMIN' },
    { account: 'new_student_02', password: 'student-secret-123', studentId: 'chosen-id' },
  ];
  const expectedStatuses = [409, 409, 400, 400, 400, 400, 400];
  for (const [index, body] of invalidBodies.entries()) {
    const response = await ctx.api('POST', '/auth/student-register', { body });
    assert.equal(response.status, expectedStatuses[index]);
    assert.equal(response.body.data, undefined);
  }
  assert.equal(ctx.db.prepare('SELECT count(*) AS count FROM users WHERE account = ?').get('new_student_02').count, 0);
});

test('并发注册同一账号至多成功一次，错误密码不能登录', async () => {
  const body = { account: 'race_student_01', password: 'student-secret-123' };
  const responses = await Promise.all([
    ctx.api('POST', '/auth/student-register', { body }),
    ctx.api('POST', '/auth/student-register', { body }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const badLogin = await ctx.api('POST', '/auth/login', {
    body: { account: body.account, password: 'wrong-password' },
  });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.data, undefined);
  assert.equal(ctx.db.prepare('SELECT count(*) AS count FROM users WHERE account = ?').get(body.account).count, 1);
});

test('密码首尾空格按原样保存和校验，账号拒绝非 ASCII 字符', async () => {
  const password = '  with-spaces-123  ';
  const registered = await ctx.api('POST', '/auth/student-register', {
    body: { account: 'space_student', password },
  });
  assert.equal(registered.status, 201);
  const correct = await ctx.api('POST', '/auth/login', {
    body: { account: 'space_student', password },
  });
  assert.equal(correct.status, 200);
  const trimmed = await ctx.api('POST', '/auth/login', {
    body: { account: 'space_student', password: password.trim() },
  });
  assert.equal(trimmed.status, 401);
  const nonAscii = await ctx.api('POST', '/auth/student-register', {
    body: { account: 'stuKent', password: 'student-secret-123' },
  });
  assert.equal(nonAscii.status, 400);
});

test('账号大小写不敏感查询命中 NOCASE 索引', () => {
  const plan = ctx.db
    .prepare('EXPLAIN QUERY PLAN SELECT * FROM users WHERE account = ? COLLATE NOCASE AND active = 1')
    .all('DEMO-STUDENT');
  const detail = plan.map((row) => row.detail).join(' ');
  assert.match(detail, /idx_users_account_nocase/);
});

test('公开认证接口具备频率限制，单地址超限不耗尽全局配额，窗口过期后恢复', async () => {
  let now = 1_000_000;
  const check = createAuthRateLimiter(() => now);
  for (let i = 0; i < 20; i += 1) {
    check({ socket: { remoteAddress: '10.0.0.1' } }, 'register');
  }
  for (let i = 0; i < 90; i += 1) {
    assert.throws(
      () => check({ socket: { remoteAddress: '10.0.0.1' } }, 'register'),
      (err) => err.code === 'RATE_LIMITED' && err.status === 429 && err.retryable === true,
    );
  }
  // 单 IP 被拒请求不应消耗全局限流配额，其他地址仍可正常请求
  assert.doesNotThrow(() => check({ socket: { remoteAddress: '10.0.0.2' } }, 'register'));

  // 真实 HTTP 接口触发注册限流并在 15 分钟窗口后恢复
  ctx.advance(15 * 60 * 1000 + 1000);
  for (let i = 0; i < 20; i += 1) {
    const res = await ctx.api('POST', '/auth/student-register', {
      body: { account: `limit_user_${i}`, password: 'student-secret-123' },
    });
    assert.equal(res.status, 201);
  }
  const limited = await ctx.api('POST', '/auth/student-register', {
    body: { account: 'limit_user_overflow', password: 'student-secret-123' },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.equal(limited.body.error.retryable, true);

  ctx.advance(15 * 60 * 1000 + 1000);
  const recovered = await ctx.api('POST', '/auth/student-register', {
    body: { account: 'limit_user_recovered', password: 'student-secret-123' },
  });
  assert.equal(recovered.status, 201);
});

test('/me 返回服务端身份与食堂，不信任客户端角色', async () => {
  const token = await ctx.login('merchant');
  const response = await ctx.api('GET', '/me', { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.role, 'MERCHANT');
  assert.equal(response.body.data.user.merchantId, 'demo-merchant-01');
  assert.equal(response.body.data.canteenId, 'demo-canteen-01');
});

test('会话过期返回 401 SESSION_EXPIRED', async () => {
  const token = await ctx.login('student');
  ctx.advance(8 * 60 * 60 * 1000 + 1000);
  const response = await ctx.api('GET', '/me', { token });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'SESSION_EXPIRED');
  ctx.advance(-(8 * 60 * 60 * 1000 + 1000));
});

test('退出登录后令牌失效', async () => {
  const token = await ctx.login('student');
  const logout = await ctx.api('POST', '/auth/logout', { token });
  assert.equal(logout.status, 204);
  const me = await ctx.api('GET', '/me', { token });
  assert.equal(me.status, 401);
});

test('角色边界：学生不能访问档口或管理端接口', async () => {
  const token = await ctx.login('student');
  const merchantOrders = await ctx.api('GET', '/merchant/orders', { token });
  assert.equal(merchantOrders.status, 403);
  assert.equal(merchantOrders.body.error.code, 'FORBIDDEN');

  const adminOrders = await ctx.api('GET', '/admin/orders', { token });
  assert.equal(adminOrders.status, 403);
  assert.equal(adminOrders.body.error.code, 'FORBIDDEN');
});

test('角色边界：档口不能替学生下单', async () => {
  const token = await ctx.login('merchant');
  const response = await ctx.api('POST', '/orders', {
    token,
    body: {
      requestId: 'merchant-create-1',
      items: [{ dishId: 'demo-dish-01', quantity: 1 }],
      slotId: 'slot-2026-11-13-lunch',
      diningMode: 'DINE_IN',
    },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});
