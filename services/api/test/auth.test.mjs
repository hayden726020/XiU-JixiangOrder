import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
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