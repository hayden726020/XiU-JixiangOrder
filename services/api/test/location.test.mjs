import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { DISH, SLOT_TODAY, SLOT_TOMORROW, orderBody, startTestServer } from './helpers.mjs';

const NOW = Date.parse('2026-11-13T11:45:00+08:00');
const LOCATION_TTL_MS = 10 * 60 * 1000;

let ctx;

beforeEach(async () => {
  ctx = await startTestServer({ now: NOW });
});

afterEach(async () => {
  await ctx.close();
});

async function report(token, requestId, presence = 'INSIDE', extra = {}) {
  return ctx.api('PUT', '/me/location', {
    token,
    body: { requestId, presence, ...extra },
  });
}

function locationRows() {
  return ctx.db.prepare('SELECT user_id, presence, observed_at FROM locations').all();
}

test('拒绝精确坐标与身份字段，且不落库', async () => {
  const token = await ctx.login('student');
  const response = await report(token, 'loc-coords-1', 'INSIDE', {
    latitude: 30.1,
    longitude: 120.2,
    userId: 'someone-else',
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_LOCATION_PAYLOAD');
  assert.equal(locationRows().length, 0);
});

test('上报一次位置并支持重复删除', async () => {
  const token = await ctx.login('student');
  const response = await report(token, 'loc-1');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.presence, 'INSIDE');
  assert.equal(Date.parse(response.body.data.expiresAt) - Date.parse(response.body.data.observedAt), LOCATION_TTL_MS);
  assert.equal(locationRows().length, 1);

  const first = await ctx.api('DELETE', '/me/location', { token });
  assert.equal(first.status, 204);
  const second = await ctx.api('DELETE', '/me/location', { token });
  assert.equal(second.status, 204);
  assert.equal(locationRows().length, 0);
});

test('同一 requestId 重放不延长位置有效期', async () => {
  const token = await ctx.login('student');
  const first = await report(token, 'loc-replay-1');
  const stored = locationRows()[0].observed_at;
  ctx.advance(5 * 60 * 1000);
  const second = await report(token, 'loc-replay-1');
  assert.equal(second.body.data.expiresAt, first.body.data.expiresAt);
  assert.equal(locationRows()[0].observed_at, stored);
});

test('同一 requestId 不同位置内容返回 REQUEST_CONFLICT', async () => {
  const token = await ctx.login('student');
  await report(token, 'loc-conflict-1', 'INSIDE');
  const response = await report(token, 'loc-conflict-1', 'OUTSIDE');
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REQUEST_CONFLICT');
});

test('当前时段堂食预约 + 有效 INSIDE 计算当前参考', async () => {
  const student = await ctx.login('student');
  const created = await ctx.api('POST', '/orders', { token: student, body: orderBody('crowd-create-1') });
  assert.equal(created.status, 201);
  await report(student, 'crowd-loc-1');

  const crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.status, 200);
  assert.equal(crowd.body.data.reservedDineInUsers, 1);
  assert.equal(crowd.body.data.currentReferenceUsers, 1);
  assert.equal(crowd.body.data.level, 'NO_ALERT');
  assert.deepEqual(crowd.body.data.basis, ['RESERVATION', 'LOCATION']);
  assert.equal(crowd.body.data.demo, true);
});

test('同用户多笔堂食只计一人，外带与取消不计入预约', async () => {
  const student = await ctx.login('student');
  await ctx.api('POST', '/orders', { token: student, body: orderBody('dedupe-1') });
  await ctx.api('POST', '/orders', { token: student, body: orderBody('dedupe-2') });
  await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('dedupe-takeaway', { diningMode: 'TAKEAWAY' }),
  });
  const cancelled = await ctx.api('POST', '/orders', { token: student, body: orderBody('dedupe-cancel') });
  await ctx.api('POST', `/orders/${cancelled.body.data.id}/cancel`, {
    token: student,
    body: { requestId: 'dedupe-cancel-op', expectedVersion: cancelled.body.data.version },
  });

  const crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.body.data.reservedDineInUsers, 1);
  assert.equal(crowd.body.data.currentReferenceUsers, null);
  assert.deepEqual(crowd.body.data.basis, ['RESERVATION']);
});

test('未来时段不返回当前参考，未来订单不混入今天', async () => {
  const student = await ctx.login('student');
  await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('future-create-1', { slotId: SLOT_TOMORROW }),
  });
  const future = await ctx.api('GET', `/crowd?slotId=${SLOT_TOMORROW}`);
  assert.equal(future.body.data.reservedDineInUsers, 1);
  assert.equal(future.body.data.currentReferenceUsers, null);
  assert.deepEqual(future.body.data.basis, ['RESERVATION']);

  const today = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(today.body.data.reservedDineInUsers, 0);
});

test('最近的 OUTSIDE 排除当前参考，位置过期后不再作为依据', async () => {
  const student = await ctx.login('student');
  await ctx.api('POST', '/orders', { token: student, body: orderBody('outside-create-1') });
  await report(student, 'outside-loc-1', 'INSIDE');
  let crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.body.data.currentReferenceUsers, 1);

  await report(student, 'outside-loc-2', 'OUTSIDE');
  crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.body.data.currentReferenceUsers, null);

  ctx.advance(11 * 60 * 1000);
  crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.body.data.currentReferenceUsers, null);
  assert.deepEqual(crowd.body.data.basis, ['RESERVATION']);
});

test('取餐记录在 30 分钟内作为当前参考，即使位置已删除', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  let order = (
    await ctx.api('POST', '/orders', { token: student, body: orderBody('pickup-create-1') })
  ).body.data;
  for (const [action, requestId] of [
    ['ACCEPT', 'pickup-accept'],
    ['START_PREPARING', 'pickup-start'],
    ['MARK_READY', 'pickup-ready'],
  ]) {
    const response = await ctx.api('POST', `/merchant/orders/${order.id}/advance`, {
      token: merchant,
      body: { requestId, expectedVersion: order.version, action },
    });
    assert.equal(response.status, 200);
    order = response.body.data;
  }
  const detail = await ctx.api('GET', `/orders/${order.id}`, { token: student });
  const verified = await ctx.api('POST', `/merchant/orders/${order.id}/verify`, {
    token: merchant,
    body: {
      requestId: 'pickup-verify',
      expectedVersion: detail.body.data.version,
      pickupCode: detail.body.data.pickupCode,
    },
  });
  assert.equal(verified.status, 200);
  await ctx.api('DELETE', '/me/location', { token: student });

  const crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.body.data.currentReferenceUsers, 1);
  assert.ok(crowd.body.data.basis.includes('PICKUP'));
});

test('超过 24 小时的位置记录被物理清除', async () => {
  const token = await ctx.login('student');
  await report(token, 'retention-1');
  assert.equal(locationRows().length, 1);
  ctx.advance(24 * 60 * 60 * 1000 + 1000);
  const freshToken = await ctx.login('student');
  const response = await ctx.api('DELETE', '/me/location', { token: freshToken });
  assert.equal(response.status, 204);
  assert.equal(locationRows().length, 0);
});

test('没有订单和位置时标记 UNKNOWN，不伪造 0 人空闲结论', async () => {
  const crowd = await ctx.api('GET', `/crowd?slotId=${SLOT_TODAY}`);
  assert.equal(crowd.status, 200);
  assert.equal(crowd.body.data.reservedDineInUsers, 0);
  assert.equal(crowd.body.data.currentReferenceUsers, null);
  assert.equal(crowd.body.data.level, 'UNKNOWN');
  assert.deepEqual(crowd.body.data.basis, []);
});

test('不存在的时段返回 404', async () => {
  const response = await ctx.api('GET', '/crowd?slotId=slot-missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'SLOT_NOT_FOUND');
});

test('位置上报只接受 INSIDE / OUTSIDE / UNKNOWN', async () => {
  const token = await ctx.login('student');
  const response = await report(token, 'invalid-presence', 'MAYBE');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});