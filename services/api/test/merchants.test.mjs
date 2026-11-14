import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { orderBody, startTestServer } from './helpers.mjs';

let ctx;

beforeEach(async () => {
  ctx = await startTestServer();
});

afterEach(async () => {
  await ctx.close();
});

test('未登录读取店铺列表返回 401', async () => {
  const response = await ctx.api('GET', '/merchants');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('学生读取店铺列表，字段完整且不泄露联系方式', async () => {
  const token = await ctx.login('student');
  const response = await ctx.api('GET', '/merchants', { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.merchants.length, 2);
  for (const merchant of response.body.data.merchants) {
    assert.equal(typeof merchant.merchantId, 'string');
    assert.equal(typeof merchant.name, 'string');
    assert.equal(typeof merchant.canteenId, 'string');
    assert.equal(typeof merchant.orderable, 'boolean');
    assert.equal(typeof merchant.sortOrder, 'number');
    assert.equal(merchant.contactPhone, undefined);
    assert.equal(merchant.contactName, undefined);
  }
  assert.equal(response.body.data.merchants[0].merchantId, 'demo-merchant-01');
  assert.equal(response.body.data.merchants[0].name, '一食堂·家常档');
  assert.equal(response.body.data.merchants[0].sortOrder, 1);
  assert.equal(response.body.data.merchants[0].orderable, true);
});

test('店铺营业时间之外 orderable=false', async () => {
  ctx.db.prepare("UPDATE merchants SET close_at = '09:00' WHERE id = 'demo-merchant-01'").run();
  const token = await ctx.login('student');
  const response = await ctx.api('GET', '/merchants', { token });
  const target = response.body.data.merchants.find((item) => item.merchantId === 'demo-merchant-01');
  assert.equal(target.orderable, false);
});

test('档口也会话可读取店铺列表', async () => {
  const token = await ctx.login('merchant');
  const response = await ctx.api('GET', '/merchants', { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.merchants.length, 2);
});

test('订单创建、详情、列表均返回 merchantId 与 merchantName 快照', async () => {
  const token = await ctx.login('student');
  const created = await ctx.api('POST', '/orders', { token, body: orderBody('merchant-fields-order-1') });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.merchantId, 'demo-merchant-01');
  assert.equal(created.body.data.merchantName, '一食堂·家常档');

  const detail = await ctx.api('GET', `/orders/${created.body.data.id}`, { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.merchantId, 'demo-merchant-01');
  assert.equal(detail.body.data.merchantName, '一食堂·家常档');

  const list = await ctx.api('GET', '/orders', { token });
  const listed = list.body.data.orders.find((order) => order.id === created.body.data.id);
  assert.equal(listed.merchantId, 'demo-merchant-01');
  assert.equal(listed.merchantName, '一食堂·家常档');

  ctx.db.prepare("UPDATE merchants SET name = '改名后的档口' WHERE id = 'demo-merchant-01'").run();
  const afterRename = await ctx.api('GET', `/orders/${created.body.data.id}`, { token });
  assert.equal(afterRename.body.data.merchantName, '一食堂·家常档');
});

test('管理端与档口订单响应包含店铺字段', async () => {
  const student = await ctx.login('student');
  const created = await ctx.api('POST', '/orders', { token: student, body: orderBody('merchant-fields-order-2') });

  const admin = await ctx.login('admin');
  const adminList = await ctx.api('GET', '/admin/orders', { token: admin });
  const adminOrder = adminList.body.data.orders.find((order) => order.id === created.body.data.id);
  assert.equal(adminOrder.merchantId, 'demo-merchant-01');
  assert.equal(adminOrder.merchantName, '一食堂·家常档');

  const merchant = await ctx.login('merchant');
  const merchantList = await ctx.api('GET', '/merchant/orders', { token: merchant });
  const merchantOrder = merchantList.body.data.orders.find((order) => order.id === created.body.data.id);
  assert.equal(merchantOrder.merchantId, 'demo-merchant-01');
  assert.equal(merchantOrder.merchantName, '一食堂·家常档');
  assert.equal(merchantOrder.pickupCode, null);
});

test('跨店订单仍只返回各自店铺字段', async () => {
  const student = await ctx.login('student');
  const created = await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('merchant-fields-order-3', { items: [{ dishId: 'demo-dish-02', quantity: 1 }] }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.merchantId, 'demo-merchant-02');
  assert.equal(created.body.data.merchantName, '一食堂·面档');

  const merchantTwo = await ctx.login('merchant');
  const ownList = await ctx.api('GET', '/merchant/orders', { token: merchantTwo });
  assert.equal(ownList.body.data.orders.some((order) => order.id === created.body.data.id), false);
});