import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { DISH, SLOT_TODAY, orderBody, startTestServer } from './helpers.mjs';

let ctx;

beforeEach(async () => {
  ctx = await startTestServer();
});

afterEach(async () => {
  await ctx.close();
});

async function createOrder(token, requestId = 'flow-create-1') {
  const response = await ctx.api('POST', '/orders', { token, body: orderBody(requestId) });
  assert.equal(response.status, 201);
  return response.body.data;
}

async function advance(token, orderId, requestId, version, action) {
  return ctx.api('POST', `/merchant/orders/${orderId}/advance`, {
    token,
    body: { requestId, expectedVersion: version, action },
  });
}

async function toReady(studentToken, merchantToken) {
  const order = await createOrder(studentToken);
  let current = order;
  for (const [action, requestId] of [
    ['ACCEPT', 'flow-accept'],
    ['START_PREPARING', 'flow-start'],
    ['MARK_READY', 'flow-ready'],
  ]) {
    const response = await advance(merchantToken, order.id, requestId, current.version, action);
    assert.equal(response.status, 200);
    current = response.body.data;
  }
  return current;
}

async function studentView(token, orderId) {
  const response = await ctx.api('GET', `/orders/${orderId}`, { token });
  assert.equal(response.status, 200);
  return response.body.data;
}

test('状态不能跳步，旧版本被拒绝', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const order = await createOrder(student);

  const skip = await advance(merchant, order.id, 'skip-1', order.version, 'MARK_READY');
  assert.equal(skip.status, 409);
  assert.equal(skip.body.error.code, 'INVALID_ORDER_STATE');

  const stale = await advance(merchant, order.id, 'stale-1', order.version + 5, 'ACCEPT');
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'ORDER_VERSION_CONFLICT');
});

test('核销只能一次，同 requestId 重试返回首次成功', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const ready = await toReady(student, merchant);
  const view = await studentView(student, ready.id);
  assert.equal(view.status, 'READY');
  assert.match(String(view.pickupCode), /^\d{6}$/);

  const wrong = await ctx.api('POST', `/merchant/orders/${ready.id}/verify`, {
    token: merchant,
    body: { requestId: 'verify-wrong', expectedVersion: view.version, pickupCode: '000000' },
  });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.body.error.code, 'PICKUP_CODE_INVALID');

  const first = await ctx.api('POST', `/merchant/orders/${ready.id}/verify`, {
    token: merchant,
    body: { requestId: 'verify-ok', expectedVersion: view.version, pickupCode: view.pickupCode },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.status, 'COMPLETED');
  assert.equal(first.body.data.pickupCode, null);

  const replay = await ctx.api('POST', `/merchant/orders/${ready.id}/verify`, {
    token: merchant,
    body: { requestId: 'verify-ok', expectedVersion: view.version, pickupCode: view.pickupCode },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.version, first.body.data.version);

  const again = await ctx.api('POST', `/merchant/orders/${ready.id}/verify`, {
    token: merchant,
    body: { requestId: 'verify-again', expectedVersion: view.version, pickupCode: view.pickupCode },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'PICKUP_CODE_USED');
});

test('未开始制作取消恢复菜品和时段名额，重复取消不重复恢复', async () => {
  const student = await ctx.login('student');
  const order = await createOrder(student);
  const before = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;

  const cancel = await ctx.api('POST', `/orders/${order.id}/cancel`, {
    token: student,
    body: { requestId: 'cancel-new-1', expectedVersion: order.version, reason: '演示取消' },
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.status, 'CANCELLED');
  assert.equal(cancel.body.data.paymentStatus, 'SIMULATED_REFUNDED');
  assert.equal(cancel.body.data.cancellationReason, '演示取消');

  const dish = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;
  assert.equal(dish, before + 1);
  const slot = ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY).booked_count;
  assert.equal(slot, 0);

  const again = await ctx.api('POST', `/orders/${order.id}/cancel`, {
    token: student,
    body: { requestId: 'cancel-new-2', expectedVersion: cancel.body.data.version, reason: '再次取消' },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'ALREADY_CANCELLED');
  const dishAfter = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;
  assert.equal(dishAfter, before + 1);
});

test('已开始制作后取消不恢复库存和名额', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const order = await createOrder(student);
  const accepted = await advance(merchant, order.id, 'cancel-accept', order.version, 'ACCEPT');
  const preparing = await advance(merchant, order.id, 'cancel-start', accepted.body.data.version, 'START_PREPARING');
  const stockBefore = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;

  const cancel = await ctx.api('POST', `/merchant/orders/${order.id}/cancel`, {
    token: merchant,
    body: { requestId: 'cancel-preparing', expectedVersion: preparing.body.data.version, reason: '演示缺货' },
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.status, 'CANCELLED');
  assert.equal(cancel.body.data.paymentStatus, 'SIMULATED_REFUNDED');

  const stockAfter = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;
  assert.equal(stockAfter, stockBefore);
  const slot = ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY).booked_count;
  assert.equal(slot, 1);
});

test('READY 可缺货取消但不恢复库存和名额', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const ready = await toReady(student, merchant);
  const stockBefore = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;
  const slotBefore = ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY).booked_count;

  const cancel = await ctx.api('POST', `/merchant/orders/${ready.id}/cancel`, {
    token: merchant,
    body: { requestId: 'cancel-ready', expectedVersion: ready.version, reason: '取餐前售罄' },
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.status, 'CANCELLED');
  assert.equal(cancel.body.data.cancellationReason, '取餐前售罄');
  assert.equal(cancel.body.data.cancelRequest.decisionReason, null);
  assert.equal(ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity, stockBefore);
  assert.equal(ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY).booked_count, slotBefore);
});

test('取消申请待处理，批准后原子退款并恢复，拒绝不改变订单状态', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const order = await createOrder(student);
  const accepted = await advance(merchant, order.id, 'apply-accept', order.version, 'ACCEPT');

  const apply = await ctx.api('POST', `/orders/${order.id}/cancel`, {
    token: student,
    body: { requestId: 'apply-1', expectedVersion: accepted.body.data.version, reason: '临时有事' },
  });
  assert.equal(apply.status, 200);
  assert.equal(apply.body.data.status, 'ACCEPTED');
  assert.equal(apply.body.data.cancelRequest.status, 'PENDING');
  assert.equal(apply.body.data.paymentStatus, 'SIMULATED_PAID');

  const reject = await ctx.api('POST', `/merchant/orders/${order.id}/cancel-decision`, {
    token: merchant,
    body: { requestId: 'decision-reject', expectedVersion: apply.body.data.version, decision: 'REJECT', reason: '已备料' },
  });
  assert.equal(reject.status, 200);
  assert.equal(reject.body.data.status, 'ACCEPTED');
  assert.equal(reject.body.data.cancelRequest.status, 'REJECTED');
  assert.equal(reject.body.data.cancelRequest.reason, '临时有事');
  assert.equal(reject.body.data.cancelRequest.decisionReason, '已备料');

  const applyAgain = await ctx.api('POST', `/orders/${order.id}/cancel`, {
    token: student,
    body: { requestId: 'apply-2', expectedVersion: reject.body.data.version, reason: '仍然需要取消' },
  });
  assert.equal(applyAgain.status, 200);
  assert.equal(applyAgain.body.data.cancelRequest.status, 'PENDING');
  assert.equal(applyAgain.body.data.cancelRequest.reason, '仍然需要取消');

  const stockBefore = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;
  const approve = await ctx.api('POST', `/merchant/orders/${order.id}/cancel-decision`, {
    token: merchant,
    body: { requestId: 'decision-approve', expectedVersion: applyAgain.body.data.version, decision: 'APPROVE', reason: '同意取消' },
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.data.status, 'CANCELLED');
  assert.equal(approve.body.data.cancelRequest.status, 'APPROVED');
  assert.equal(approve.body.data.cancelRequest.reason, '仍然需要取消');
  assert.equal(approve.body.data.cancelRequest.decisionReason, '同意取消');
  assert.equal(approve.body.data.paymentStatus, 'SIMULATED_REFUNDED');
  const stockAfter = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH).available_quantity;
  assert.equal(stockAfter, stockBefore + 1);
});

test('取餐完成时同一操作结束待处理取消申请', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const acceptedOrder = await createOrder(student);
  const accepted = await advance(merchant, acceptedOrder.id, 'pending-accept', acceptedOrder.version, 'ACCEPT');
  const preparing = await advance(merchant, acceptedOrder.id, 'pending-start', accepted.body.data.version, 'START_PREPARING');
  const ready = await advance(merchant, acceptedOrder.id, 'pending-ready', preparing.body.data.version, 'MARK_READY');
  const view = await studentView(student, ready.body.data.id);

  const apply = await ctx.api('POST', `/orders/${view.id}/cancel`, {
    token: student,
    body: { requestId: 'pending-apply', expectedVersion: view.version, reason: '想取消' },
  });
  assert.equal(apply.status, 200);
  assert.equal(apply.body.data.cancelRequest.status, 'PENDING');

  const verified = await ctx.api('POST', `/merchant/orders/${view.id}/verify`, {
    token: merchant,
    body: { requestId: 'pending-verify', expectedVersion: apply.body.data.version, pickupCode: view.pickupCode },
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.status, 'COMPLETED');
  assert.equal(verified.body.data.cancelRequest.status, 'REJECTED');
  assert.equal(verified.body.data.cancelRequest.reason, '想取消');
  assert.equal(verified.body.data.cancelRequest.decisionReason, '订单已取餐');
});

test('延迟仅在接单后允许，并与用餐方式修改一起持久化理由', async () => {
  const student = await ctx.login('student');
  const merchant = await ctx.login('merchant');
  const order = await createOrder(student);

  const earlyDelay = await ctx.api('POST', `/merchant/orders/${order.id}/delay`, {
    token: merchant,
    body: {
      requestId: 'delay-early',
      expectedVersion: order.version,
      reason: '备餐延迟',
      expectedReadyAt: '2026-11-13T11:45:00+08:00',
    },
  });
  assert.equal(earlyDelay.status, 409);
  assert.equal(earlyDelay.body.error.code, 'INVALID_ORDER_STATE');

  const accepted = await advance(merchant, order.id, 'delay-accept', order.version, 'ACCEPT');
  const delayed = await ctx.api('POST', `/merchant/orders/${order.id}/delay`, {
    token: merchant,
    body: {
      requestId: 'delay-1',
      expectedVersion: accepted.body.data.version,
      reason: '备餐延迟',
      expectedReadyAt: '2026-11-13T11:45:00+08:00',
    },
  });
  assert.equal(delayed.status, 200);
  assert.equal(delayed.body.data.delay.reason, '备餐延迟');

  const changed = await ctx.api('PATCH', `/merchant/orders/${order.id}/dining-mode`, {
    token: merchant,
    body: {
      requestId: 'mode-1',
      expectedVersion: delayed.body.data.version,
      diningMode: 'TAKEAWAY',
      reason: '学生改为外带',
    },
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.data.diningMode, 'TAKEAWAY');
  assert.equal(changed.body.data.diningModeReason, '学生改为外带');

  const studentOrder = await studentView(student, order.id);
  assert.equal(studentOrder.delay.reason, '备餐延迟');
  assert.equal(studentOrder.diningMode, 'TAKEAWAY');
  assert.equal(studentOrder.diningModeReason, '学生改为外带');
});

test('档口不能操作其他档口订单', async () => {
  const student = await ctx.login('student');
  const order = await createOrder(student);
  ctx.addUser({
    id: 'test-merchant-3',
    account: 'test-merchant-3',
    password: 'merchant3-pass-123',
    displayName: '第三个档口',
    role: 'MERCHANT',
    merchantId: 'demo-merchant-02',
  });
  const login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'test-merchant-3', password: 'merchant3-pass-123' },
  });
  const otherMerchant = login.body.data.token;
  const response = await advance(otherMerchant, order.id, 'other-accept', order.version, 'ACCEPT');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'ORDER_NOT_FOUND');
});