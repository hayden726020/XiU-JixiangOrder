import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { startTestServer } from './helpers.mjs';

let ctx;

beforeEach(async () => {
  ctx = await startTestServer();
});

afterEach(async () => {
  await ctx.close();
});

test('未登录读取商家钱包返回 401', async () => {
  const response = await ctx.api('GET', '/merchant/wallet');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('学生读取商家钱包返回 403', async () => {
  const token = await ctx.login('student');
  const response = await ctx.api('GET', '/merchant/wallet', { token });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('管理员读取商家钱包返回 403', async () => {
  const token = await ctx.login('admin');
  const response = await ctx.api('GET', '/merchant/wallet', { token });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('档口读取钱包返回 501 占位且文案逐字同源', async () => {
  const token = await ctx.login('merchant');
  const response = await ctx.api('GET', '/merchant/wallet', { token });
  assert.equal(response.status, 501);
  assert.equal(response.body.error.code, 'NOT_IMPLEMENTED');
  assert.equal(response.body.error.message, '钱包暂未接入共同服务；余额与提现暂不可用。');
  assert.equal(response.body.error.retryable, false);
  assert.equal(response.body.data, undefined);
});

test('过期令牌读取商家钱包返回 401', async () => {
  const token = await ctx.login('merchant');
  ctx.advance(8 * 60 * 60 * 1000 + 1);
  const response = await ctx.api('GET', '/merchant/wallet', { token });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'SESSION_EXPIRED');
});

test('未登录发起商家提现返回 401', async () => {
  const response = await ctx.api('POST', '/merchant/wallet/withdraw', {
    body: { amountFen: 500, requestId: 'w-test-1' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('学生发起商家提现返回 403', async () => {
  const token = await ctx.login('student');
  const response = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token,
    body: { amountFen: 500, requestId: 'w-test-2' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('管理员发起商家提现返回 403', async () => {
  const token = await ctx.login('admin');
  const response = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token,
    body: { amountFen: 500, requestId: 'w-test-3' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('档口发起提现返回 501 占位且文案逐字同源', async () => {
  const token = await ctx.login('merchant');
  const response = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token,
    body: { amountFen: 500, requestId: 'w-test-4' },
  });
  assert.equal(response.status, 501);
  assert.equal(response.body.error.code, 'NOT_IMPLEMENTED');
  assert.equal(response.body.error.message, '钱包暂未接入共同服务；提现暂不可用。');
  assert.equal(response.body.error.retryable, false);
  assert.equal(response.body.data, undefined);
});

test('过期令牌发起商家提现返回 401', async () => {
  const token = await ctx.login('merchant');
  ctx.advance(8 * 60 * 60 * 1000 + 1);
  const response = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token,
    body: { amountFen: 500, requestId: 'w-test-5' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'SESSION_EXPIRED');
});