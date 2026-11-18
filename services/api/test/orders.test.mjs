import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { DISH, SLOT_TODAY, SLOT_TOMORROW, orderBody, startTestServer } from './helpers.mjs';

let ctx;

beforeEach(async () => {
  ctx = await startTestServer();
});

afterEach(async () => {
  await ctx.close();
});

async function placeOrder(token, requestId, overrides = {}) {
  return ctx.api('POST', '/orders', { token, body: orderBody(requestId, overrides) });
}

test('下单由服务端计价并扣减库存与名额', async () => {
  const token = await ctx.login('student');
  const response = await placeOrder(token, 'create-1', {
    items: [{ dishId: DISH, quantity: 2 }],
    totalFen: 1,
  });
  assert.equal(response.status, 201);
  const order = response.body.data;
  assert.equal(order.totalFen, 3600);
  assert.equal(order.status, 'NEW');
  assert.equal(order.paymentStatus, 'SIMULATED_PAID');
  assert.equal(order.version, 1);
  assert.equal(order.pickupCode, null);

  const dish = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH);
  assert.equal(dish.available_quantity, 18);
  const slot = ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY);
  assert.equal(slot.booked_count, 1);

  const list = await ctx.api('GET', '/orders', { token });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.orders.length, 1);
});

test('同一 requestId 重试返回首次订单，不重复扣库存', async () => {
  const token = await ctx.login('student');
  const first = await placeOrder(token, 'retry-1');
  const second = await placeOrder(token, 'retry-1');
  assert.equal(second.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
  const dish = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH);
  assert.equal(dish.available_quantity, 19);
  const count = ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  assert.equal(count, 1);
});

test('同一 requestId 不同内容返回 409 REQUEST_CONFLICT', async () => {
  const token = await ctx.login('student');
  await placeOrder(token, 'conflict-1');
  const response = await placeOrder(token, 'conflict-1', { diningMode: 'TAKEAWAY' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REQUEST_CONFLICT');
  const count = ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  assert.equal(count, 1);
});

test('库存不足不创建订单且不扣库存', async () => {
  const token = await ctx.login('student');
  ctx.db.prepare('UPDATE dishes SET available_quantity = 0 WHERE id = ?').run(DISH);
  const response = await placeOrder(token, 'stock-1');
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'OUT_OF_STOCK');
  const count = ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  assert.equal(count, 0);
  const slot = ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY);
  assert.equal(slot.booked_count, 0);
});

test('只剩一份时并发下单最多成功一笔', async () => {
  const token = await ctx.login('student');
  ctx.db.prepare('UPDATE dishes SET available_quantity = 1 WHERE id = ?').run(DISH);
  const [first, second] = await Promise.all([
    placeOrder(token, 'race-stock-1'),
    placeOrder(token, 'race-stock-2'),
  ]);
  const successes = [first, second].filter((response) => response.status === 201);
  assert.equal(successes.length, 1);
  const dish = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(DISH);
  assert.equal(dish.available_quantity, 0);
  const count = ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  assert.equal(count, 1);
});

test('并发下单不受时段名额限制', async () => {
  const token = await ctx.login('student');
  ctx.db.prepare('UPDATE slots SET capacity = 1, booked_count = 0 WHERE id = ?').run(SLOT_TODAY);
  const [first, second] = await Promise.all([
    placeOrder(token, 'race-slot-1'),
    placeOrder(token, 'race-slot-2'),
  ]);
  const successes = [first, second].filter((response) => response.status === 201);
  assert.equal(successes.length, 2);
  const slot = ctx.db.prepare('SELECT booked_count FROM slots WHERE id = ?').get(SLOT_TODAY);
  assert.equal(slot.booked_count, 2);
});

test('当前时段之前的已结束时段在菜单中禁用且不可下单，当前时段仍可下单', async () => {
  const token = await ctx.login('student');
  ctx.setNow(Date.parse('2026-11-13T12:00:00+08:00'));
  const menu = await ctx.api('GET', '/menu?date=2026-11-13', { token });
  const endedSlot = menu.body.data.slots.find((item) => item.id === SLOT_TODAY);
  const currentSlot = menu.body.data.slots.find((item) => item.id === 'slot-2026-11-13-lunch-2');
  assert.equal(endedSlot.enabled, false);
  assert.equal(currentSlot.enabled, true);

  const rejected = await placeOrder(token, 'ended-slot-1');
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error.code, 'SLOT_CLOSED');

  ctx.setNow(Date.parse('2026-11-13T12:05:00+08:00'));
  const currentOrder = await placeOrder(token, 'current-slot-1', {
    slotId: 'slot-2026-11-13-lunch-2',
  });
  assert.equal(currentOrder.status, 201);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 1);
});

test('服务端停用的时段仍不可下单', async () => {
  const token = await ctx.login('student');
  ctx.db.prepare('UPDATE slots SET enabled = 0 WHERE id = ?').run(SLOT_TODAY);
  const response = await placeOrder(token, 'disabled-slot-1');
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'SLOT_CLOSED');
});

test('跨档口菜品不能组成同一订单', async () => {
  const token = await ctx.login('student');
  const response = await placeOrder(token, 'cross-merchant-1', {
    items: [
      { dishId: 'demo-dish-01', quantity: 1 },
      { dishId: 'demo-dish-02', quantity: 1 },
    ],
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('学生只能查看自己的订单，档口只能查看本档口订单', async () => {
  const studentToken = await ctx.login('student');
  const created = await placeOrder(studentToken, 'privacy-1');
  const orderId = created.body.data.id;

  ctx.addUser({
    id: 'test-student-2',
    account: 'test-student-2',
    password: 'student2-pass-123',
    displayName: '第二个学生',
    role: 'STUDENT',
    studentId: 'test-student-02',
  });
  const student2Login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'test-student-2', password: 'student2-pass-123' },
  });
  const student2Token = student2Login.body.data.token;

  const otherView = await ctx.api('GET', `/orders/${orderId}`, { token: student2Token });
  assert.equal(otherView.status, 404);
  const otherList = await ctx.api('GET', '/orders', { token: student2Token });
  assert.equal(otherList.body.data.orders.length, 0);

  ctx.addUser({
    id: 'test-merchant-2',
    account: 'test-merchant-2',
    password: 'merchant2-pass-123',
    displayName: '第二个档口',
    role: 'MERCHANT',
    merchantId: 'demo-merchant-02',
  });
  const merchant2Login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'test-merchant-2', password: 'merchant2-pass-123' },
  });
  const merchant2Token = merchant2Login.body.data.token;
  const merchantView = await ctx.api('GET', `/orders/${orderId}`, { token: merchant2Token });
  assert.equal(merchantView.status, 404);

  const adminToken = await ctx.login('admin');
  const adminView = await ctx.api('GET', `/orders/${orderId}`, { token: adminToken });
  assert.equal(adminView.status, 200);
});

test('菜单允许未来 7 天（08:00-22:00 共 28 个时段）并支持跨日预约下单', async () => {
  const today = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(today.status, 200);
  assert.equal(today.body.data.date, '2026-11-13');
  assert.equal(today.body.data.slots.length, 28);
  assert.ok(today.body.data.slots[0].startAt.includes('T08:00:00+08:00'));
  assert.ok(today.body.data.slots[today.body.data.slots.length - 1].endAt.includes('T22:00:00+08:00'));
  const lunchSlot = today.body.data.slots.find((item) => item.id === SLOT_TODAY);
  const lunch3Slot = today.body.data.slots.find((item) => item.id === 'slot-2026-11-13-lunch-3');
  assert.equal(lunchSlot.remainingCapacity, 20);
  assert.equal(lunch3Slot.remainingCapacity, 0);
  assert.equal(lunch3Slot.enabled, true);
  assert.ok(today.body.data.dishes.length >= 1);

  const studentToken = await ctx.login('student');
  const fullSlot = await placeOrder(studentToken, 'full-slot-1', {
    slotId: 'slot-2026-11-13-lunch-3',
  });
  assert.equal(fullSlot.status, 201);
  assert.equal(fullSlot.body.data.slotId, 'slot-2026-11-13-lunch-3');

  const tomorrow = await ctx.api('GET', '/menu?date=2026-11-14');
  assert.equal(tomorrow.status, 200);
  assert.equal(tomorrow.body.data.slots.some((item) => item.id === SLOT_TOMORROW), true);

  const day7 = await ctx.api('GET', '/menu?date=2026-11-19');
  assert.equal(day7.status, 200);
  assert.equal(day7.body.data.slots.length, 28);
  const day7Order = await placeOrder(studentToken, 'day7-slot-1', {
    slotId: 'slot-2026-11-19-1800',
  });
  assert.equal(day7Order.status, 201);

  const invalid = await ctx.api('GET', '/menu?date=2026-11-20');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
});
test('档口订单列表支持状态筛选分页且不暴露取餐码', async () => {
  const studentToken = await ctx.login('student');
  const merchantToken = await ctx.login('merchant');
  const created = await placeOrder(studentToken, 'merchant-list-create');
  let current = created.body.data;

  for (const [requestId, action] of [
    ['merchant-list-accept', 'ACCEPT'],
    ['merchant-list-start', 'START_PREPARING'],
    ['merchant-list-ready', 'MARK_READY'],
  ]) {
    const advanced = await ctx.api('POST', `/merchant/orders/${current.id}/advance`, {
      token: merchantToken,
      body: { requestId, expectedVersion: current.version, action },
    });
    assert.equal(advanced.status, 200);
    current = advanced.body.data;
  }

  const studentView = await ctx.api('GET', `/orders/${current.id}`, { token: studentToken });
  assert.match(String(studentView.body.data.pickupCode), /^\d{6}$/);

  const list = await ctx.api('GET', '/merchant/orders?status=READY&page=1&pageSize=10', {
    token: merchantToken,
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.orders.length, 1);
  assert.equal(list.body.data.orders[0].pickupCode, null);
  assert.equal(list.body.data.page, 1);
  assert.equal(list.body.data.pageSize, 10);
  assert.equal(list.body.data.total, 1);

  const merchantView = await ctx.api('GET', `/orders/${current.id}`, { token: merchantToken });
  assert.equal(merchantView.status, 200);
  assert.equal(merchantView.body.data.pickupCode, null);

  const invalidStatus = await ctx.api('GET', '/merchant/orders?status=INVALID', { token: merchantToken });
  assert.equal(invalidStatus.status, 400);
  assert.equal(invalidStatus.body.error.code, 'VALIDATION_ERROR');
});

test('订单备注随订单保存并在列表与详情返回', async () => {
  const token = await ctx.login('student');
  const response = await placeOrder(token, 'remark-1', { remark: '少放盐，多给点汤汁' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.remark, '少放盐，多给点汤汁');

  const list = await ctx.api('GET', '/orders', { token });
  assert.equal(list.body.data.orders[0].remark, '少放盐，多给点汤汁');

  const detail = await ctx.api('GET', `/orders/${response.body.data.id}`, { token });
  assert.equal(detail.body.data.remark, '少放盐，多给点汤汁');
});

test('未填写备注时订单备注为 null', async () => {
  const token = await ctx.login('student');
  const response = await placeOrder(token, 'remark-null');
  assert.equal(response.status, 201);
  assert.equal(response.body.data.remark, null);
});

test('订单备注超过 50 字被拒绝且不创建订单', async () => {
  const token = await ctx.login('student');
  const response = await placeOrder(token, 'remark-2', { remark: '备'.repeat(51) });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  const count = ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  assert.equal(count, 0);
});

test('同一 requestId 修改备注视为不同内容', async () => {
  const token = await ctx.login('student');
  await placeOrder(token, 'remark-3', { remark: '少放盐' });
  const response = await placeOrder(token, 'remark-3', { remark: '不要辣' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REQUEST_CONFLICT');
});
