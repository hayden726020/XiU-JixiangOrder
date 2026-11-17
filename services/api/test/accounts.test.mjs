import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { startTestServer } from './helpers.mjs';

let ctx;
let adminToken;

beforeEach(async () => {
  ctx = await startTestServer();
  adminToken = await ctx.login('admin');
});

afterEach(async () => {
  await ctx.close();
});

function accountBody(requestId, overrides = {}) {
  return {
    requestId,
    account: 'kaidian-01',
    password: 'kaidian-pass-1',
    merchantName: '开饭档',
    contactName: '王五',
    contactPhone: '13700137000',
    ...overrides,
  };
}

test('管理端可生成并存储商家账号', async () => {
  const created = await ctx.api('POST', '/admin/merchant-accounts', {
    token: adminToken,
    body: accountBody('account-create-1'),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.account, 'kaidian-01');
  assert.equal(created.body.data.password, 'kaidian-pass-1');
  assert.match(created.body.data.merchantId, /^m_/);

  const login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'kaidian-01', password: 'kaidian-pass-1' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'MERCHANT');

  const list = await ctx.api('GET', '/admin/merchant-accounts', { token: adminToken });
  assert.equal(list.status, 200);
  const row = list.body.data.accounts.find((item) => item.account === 'kaidian-01');
  assert.ok(row);
  assert.equal(row.password, 'kaidian-pass-1');
  assert.equal(row.merchantName, '开饭档');
});

test('重复账号与重复电话被拒绝，非管理员不能生成', async () => {
  await ctx.api('POST', '/admin/merchant-accounts', {
    token: adminToken,
    body: accountBody('account-create-2'),
  });

  const duplicate = await ctx.api('POST', '/admin/merchant-accounts', {
    token: adminToken,
    body: accountBody('account-create-3', { contactPhone: '13700137001' }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'ACCOUNT_TAKEN');

  const duplicatePhone = await ctx.api('POST', '/admin/merchant-accounts', {
    token: adminToken,
    body: accountBody('account-create-4', { account: 'kaidian-02' }),
  });
  assert.equal(duplicatePhone.status, 409);
  assert.equal(duplicatePhone.body.error.code, 'CONTACT_PHONE_TAKEN');

  const student = await ctx.login('student');
  const forbidden = await ctx.api('POST', '/admin/merchant-accounts', {
    token: student,
    body: accountBody('account-create-5', { account: 'kaidian-03', contactPhone: '13700137002' }),
  });
  assert.equal(forbidden.status, 403);
});

test('商家修改账号密码后管理端资料同步', async () => {
  await ctx.api('POST', '/admin/merchant-accounts', {
    token: adminToken,
    body: accountBody('account-create-6'),
  });
  const login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'kaidian-01', password: 'kaidian-pass-1' },
  });
  const merchantToken = login.body.data.token;

  const updated = await ctx.api('PATCH', '/merchant/account', {
    token: merchantToken,
    body: {
      requestId: 'account-update-1',
      account: 'kaidian-new',
      password: 'kaidian-pass-2',
      contactName: '王六',
      contactPhone: '13700137009',
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.account, 'kaidian-new');
  assert.equal(updated.body.data.password, 'kaidian-pass-2');

  const oldLogin = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'kaidian-01', password: 'kaidian-pass-1' },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'kaidian-new', password: 'kaidian-pass-2' },
  });
  assert.equal(newLogin.status, 200);

  const list = await ctx.api('GET', '/admin/merchant-accounts', { token: adminToken });
  const row = list.body.data.accounts.find((item) => item.merchantId === updated.body.data.merchantId);
  assert.ok(row);
  assert.equal(row.account, 'kaidian-new');
  assert.equal(row.password, 'kaidian-pass-2');
  assert.equal(row.contactName, '王六');
});