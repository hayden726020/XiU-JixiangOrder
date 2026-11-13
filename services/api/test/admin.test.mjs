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

const diningValue = {
  canteenId: 'demo-canteen-01',
  name: '演示食堂',
  center: { latitude: 30, longitude: 120 },
  radiusMeters: 180,
  accuracyToleranceMeters: 60,
  demo: true,
};

test('学生不能读写管理配置，管理员可以读取', async () => {
  const student = await ctx.login('student');
  const denied = await ctx.api('GET', '/admin/settings', { token: student });
  assert.equal(denied.status, 403);

  const admin = await ctx.login('admin');
  const allowed = await ctx.api('GET', '/admin/settings', { token: admin });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.dining.radiusMeters, 150);
  assert.equal(allowed.body.data.crowd.crowdedAt, 10);
});

test('管理员修改食堂范围后公开配置同步更新', async () => {
  const admin = await ctx.login('admin');
  const before = await ctx.api('GET', '/admin/settings', { token: admin });
  const update = await ctx.api('PUT', '/admin/settings', {
    token: admin,
    body: {
      requestId: 'settings-dining-1',
      section: 'dining',
      expectedVersion: before.body.data.dining.version,
      value: diningValue,
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.version, before.body.data.dining.version + 1);

  const config = await ctx.api('GET', '/dining/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.data.radiusMeters, 180);

  const stale = await ctx.api('PUT', '/admin/settings', {
    token: admin,
    body: {
      requestId: 'settings-dining-2',
      section: 'dining',
      expectedVersion: before.body.data.dining.version,
      value: diningValue,
    },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'SETTING_VERSION_CONFLICT');
});

test('管理员调整提醒阈值后人数等级随之变化', async () => {
  const student = await ctx.login('student');
  const admin = await ctx.login('admin');
  await ctx.api('POST', '/orders', { token: student, body: orderBody('threshold-order-1') });

  const settings = await ctx.api('GET', '/admin/settings', { token: admin });
  const update = await ctx.api('PUT', '/admin/settings', {
    token: admin,
    body: {
      requestId: 'settings-crowd-1',
      section: 'crowd',
      expectedVersion: settings.body.data.crowd.version,
      value: { crowdedAt: 1, demo: true },
    },
  });
  assert.equal(update.status, 200);

  const crowd = await ctx.api('GET', '/crowd?slotId=slot-2026-11-13-lunch');
  assert.equal(crowd.body.data.reservedDineInUsers, 1);
  assert.equal(crowd.body.data.level, 'CROWDED');
});

test('管理订单查询只读、分页且不暴露取餐码', async () => {
  const student = await ctx.login('student');
  const admin = await ctx.login('admin');
  const created = await ctx.api('POST', '/orders', { token: student, body: orderBody('admin-order-1') });
  assert.equal(created.status, 201);

  const list = await ctx.api('GET', '/admin/orders?page=1&pageSize=10', { token: admin });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.total, 1);
  assert.equal(list.body.data.orders[0].pickupCode, null);
  assert.equal(list.body.data.orders[0].id, created.body.data.id);
});

test('学生访问管理订单返回 403', async () => {
  const student = await ctx.login('student');
  const response = await ctx.api('GET', '/admin/orders', { token: student });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});