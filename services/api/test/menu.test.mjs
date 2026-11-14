import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { DISH, SLOT_TODAY, startTestServer } from './helpers.mjs';

let ctx;

beforeEach(async () => {
  ctx = await startTestServer();
});

afterEach(async () => {
  await ctx.close();
});

function dishBody(requestId, overrides = {}) {
  return {
    requestId,
    expectedVersion: 1,
    priceFen: 2000,
    availableQuantity: 5,
    onSale: true,
    ...overrides,
  };
}

function slotBody(requestId, overrides = {}) {
  return {
    requestId,
    expectedVersion: 1,
    capacity: 25,
    enabled: true,
    ...overrides,
  };
}

test('GET /menu 返回菜品与时段 version', async () => {
  const response = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(response.status, 200);
  const dish = response.body.data.dishes.find((item) => item.id === DISH);
  assert.equal(dish.version, 1);
  for (const slot of response.body.data.slots) {
    assert.equal(typeof slot.version, 'number');
  }
});

test('档口保存菜品后 version + 1，GET /menu 同步更新', async () => {
  const token = await ctx.login('merchant');
  const saved = await ctx.api('PUT', `/merchant/menu/${DISH}`, {
    token,
    body: dishBody('menu-dish-1'),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.id, DISH);
  assert.equal(saved.body.data.merchantId, 'demo-merchant-01');
  assert.equal(saved.body.data.priceFen, 2000);
  assert.equal(saved.body.data.version, 2);

  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  const dish = menu.body.data.dishes.find((item) => item.id === DISH);
  assert.equal(dish.priceFen, 2000);
  assert.equal(dish.availableQuantity, 5);
  assert.equal(dish.version, 2);
});

test('旧 expectedVersion 保存菜品返回 MENU_VERSION_CONFLICT，数据不被覆盖', async () => {
  const token = await ctx.login('merchant');
  await ctx.api('PUT', `/merchant/menu/${DISH}`, { token, body: dishBody('menu-dish-1') });
  const stale = await ctx.api('PUT', `/merchant/menu/${DISH}`, {
    token,
    body: dishBody('menu-dish-2', { priceFen: 2100 }),
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'MENU_VERSION_CONFLICT');

  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  const dish = menu.body.data.dishes.find((item) => item.id === DISH);
  assert.equal(dish.priceFen, 2000);
  assert.equal(dish.version, 2);
});

test('同一 requestId 重试菜品保存返回首次结果，不重复递增', async () => {
  const token = await ctx.login('merchant');
  const body = dishBody('menu-dish-retry', { expectedVersion: 1 });
  const first = await ctx.api('PUT', `/merchant/menu/${DISH}`, { token, body });
  const second = await ctx.api('PUT', `/merchant/menu/${DISH}`, { token, body });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.version, 2);
  assert.equal(second.body.data.version, 2);
  const row = ctx.db.prepare('SELECT version FROM dishes WHERE id = ?').get(DISH);
  assert.equal(row.version, 2);
});

test('非本档口菜品保存返回 404 DISH_NOT_FOUND', async () => {
  const token = await ctx.login('merchant');
  const response = await ctx.api('PUT', '/merchant/menu/demo-dish-02', {
    token,
    body: dishBody('menu-dish-other'),
  });
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'DISH_NOT_FOUND');
});

test('学生不能保存菜品', async () => {
  const token = await ctx.login('student');
  const response = await ctx.api('PUT', `/merchant/menu/${DISH}`, {
    token,
    body: dishBody('menu-dish-student'),
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('未登录不能保存菜品', async () => {
  const response = await ctx.api('PUT', `/merchant/menu/${DISH}`, {
    body: dishBody('menu-dish-anon'),
  });
  assert.equal(response.status, 401);
});

test('档口保存时段后 version + 1，GET /menu 同步更新', async () => {
  const token = await ctx.login('merchant');
  const saved = await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token,
    body: slotBody('menu-slot-1'),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.id, SLOT_TODAY);
  assert.equal(saved.body.data.capacity, 25);
  assert.equal(saved.body.data.version, 2);

  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  const slot = menu.body.data.slots.find((item) => item.id === SLOT_TODAY);
  assert.equal(slot.capacity, 25);
  assert.equal(slot.version, 2);
});

test('容量低于已占名额返回 INVALID_ORDER_STATE', async () => {
  const token = await ctx.login('merchant');
  ctx.db.prepare('UPDATE slots SET booked_count = 5 WHERE id = ?').run(SLOT_TODAY);
  const response = await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token,
    body: slotBody('menu-slot-too-small', { capacity: 4 }),
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'INVALID_ORDER_STATE');
  const slot = ctx.db.prepare('SELECT capacity FROM slots WHERE id = ?').get(SLOT_TODAY);
  assert.equal(slot.capacity, 20);
});

test('旧 expectedVersion 保存时段返回 MENU_VERSION_CONFLICT', async () => {
  const token = await ctx.login('merchant');
  await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token,
    body: slotBody('menu-slot-1'),
  });
  const stale = await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token,
    body: slotBody('menu-slot-2', { capacity: 30 }),
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'MENU_VERSION_CONFLICT');
  const slot = ctx.db.prepare('SELECT capacity, version FROM slots WHERE id = ?').get(SLOT_TODAY);
  assert.equal(slot.capacity, 25);
  assert.equal(slot.version, 2);
});

test('学生不能保存时段，管理员可以保存时段', async () => {
  const student = await ctx.login('student');
  const forbidden = await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token: student,
    body: slotBody('menu-slot-student'),
  });
  assert.equal(forbidden.status, 403);

  const admin = await ctx.login('admin');
  const allowed = await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token: admin,
    body: slotBody('menu-slot-admin'),
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.version, 2);
});