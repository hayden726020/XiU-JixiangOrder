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

test('容量低于已占名额仍可保存时段开关与配置（无名额下限限制）', async () => {
  const token = await ctx.login('merchant');
  ctx.db.prepare('UPDATE slots SET booked_count = 5 WHERE id = ?').run(SLOT_TODAY);
  const response = await ctx.api('PUT', `/merchant/slots/${SLOT_TODAY}`, {
    token,
    body: slotBody('menu-slot-no-limit', { capacity: 4, enabled: false }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.enabled, false);
  assert.equal(response.body.data.remainingCapacity, 0);
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
test('档口可修改菜品名称与类别', async () => {
  const token = await ctx.login('merchant');
  const saved = await ctx.api('PUT', `/merchant/menu/${DISH}`, {
    token,
    body: dishBody('menu-rename-1', { name: '新鸡肉饭', type: 'SET' }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.name, '新鸡肉饭');
  assert.equal(saved.body.data.type, 'SET');
  assert.equal(saved.body.data.version, 2);

  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  const dish = menu.body.data.dishes.find((item) => item.id === DISH);
  assert.equal(dish.name, '新鸡肉饭');
  assert.equal(dish.type, 'SET');
});

test('档口可删除菜品，删除后菜单不再返回', async () => {
  const token = await ctx.login('merchant');
  const removed = await ctx.api('DELETE', `/merchant/menu/${DISH}`, {
    token,
    body: { requestId: 'menu-delete-1', expectedVersion: 1 },
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.id, DISH);

  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(menu.body.data.dishes.some((item) => item.id === DISH), false);
});

test('删除有未结束订单的菜品返回 DISH_IN_USE', async () => {
  const student = await ctx.login('student');
  const order = await ctx.api('POST', '/orders', { token: student, body: orderBody('delete-in-use-order') });
  assert.equal(order.status, 201);

  const token = await ctx.login('merchant');
  const current = ctx.db.prepare('SELECT version FROM dishes WHERE id = ?').get(DISH);
  const removed = await ctx.api('DELETE', `/merchant/menu/${DISH}`, {
    token,
    body: { requestId: 'menu-delete-2', expectedVersion: current.version },
  });
  assert.equal(removed.status, 409);
  assert.equal(removed.body.error.code, 'DISH_IN_USE');
});

test('删除菜品受版本与档口归属约束', async () => {
  const token = await ctx.login('merchant');
  const stale = await ctx.api('DELETE', `/merchant/menu/${DISH}`, {
    token,
    body: { requestId: 'menu-delete-3', expectedVersion: 2 },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'MENU_VERSION_CONFLICT');

  const otherDish = await ctx.api('DELETE', '/merchant/menu/demo-dish-02', {
    token,
    body: { requestId: 'menu-delete-4', expectedVersion: 1 },
  });
  assert.equal(otherDish.status, 404);
  assert.equal(otherDish.body.error.code, 'DISH_NOT_FOUND');

  const student = await ctx.login('student');
  const forbiddenDelete = await ctx.api('DELETE', `/merchant/menu/${DISH}`, {
    token: student,
    body: { requestId: 'menu-delete-5', expectedVersion: 1 },
  });
  assert.equal(forbiddenDelete.status, 403);
});

test('GET /menu 传入 merchantId 时按商家过滤菜品，未知商家返回空列表，空值返回 400', async () => {
  const m1 = await ctx.api('GET', '/menu?date=2026-11-13&merchantId=demo-merchant-01');
  assert.equal(m1.status, 200);
  assert.deepEqual(
    m1.body.data.dishes.map((item) => item.id),
    ['demo-dish-01', 'demo-dish-03'],
  );
  assert.ok(m1.body.data.dishes.every((item) => item.merchantId === 'demo-merchant-01'));

  const m2 = await ctx.api('GET', '/menu?merchantId=demo-merchant-02');
  assert.equal(m2.status, 200);
  assert.deepEqual(
    m2.body.data.dishes.map((item) => item.id),
    ['demo-dish-02'],
  );

  const missing = await ctx.api('GET', '/menu?date=2026-11-13&merchantId=nonexistent-merchant');
  assert.equal(missing.status, 200);
  assert.deepEqual(missing.body.data.dishes, []);

  const empty = await ctx.api('GET', '/menu?date=2026-11-13&merchantId=');
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'VALIDATION_ERROR');

  const blank = await ctx.api('GET', '/menu?date=2026-11-13&merchantId=%20%20');
  assert.equal(blank.status, 400);
  assert.equal(blank.body.error.code, 'VALIDATION_ERROR');

  const all = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(all.status, 200);
  assert.deepEqual(
    all.body.data.dishes.map((item) => item.id),
    ['demo-dish-01', 'demo-dish-03', 'demo-dish-02'],
  );
});

test('GET /menu 传入 shopId 与每日菜单时仅返回对应店铺当日上架菜品', async () => {
  const token = await ctx.login('merchant');
  await ctx.api('POST', '/merchant/registration', {
    token,
    body: {
      requestId: 'menu-filter-reg-1',
      merchantName: '分店测试商家',
      contactName: '张三',
      contactPhone: '13800138001',
    },
  });
  const shop1Res = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'menu-filter-shop-1', shopName: '一店', location: '一楼' },
  });
  const shop2Res = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'menu-filter-shop-2', shopName: '二店', location: '二楼' },
  });
  const shop1Id = shop1Res.body.data.shops[0].id;
  const shop2Id = shop2Res.body.data.shops[1].id;
  const shop2MerchantId = shop2Res.body.data.shops[1].merchantId;

  const dish2Res = await ctx.api('POST', '/merchant/menu', {
    token,
    body: {
      requestId: 'menu-filter-dish-2',
      shopId: shop2Id,
      type: 'STAPLE',
      name: '二店牛肉面',
      priceFen: 1900,
      availableQuantity: 12,
      onSale: true,
    },
  });
  assert.equal(dish2Res.status, 201);
  const dish2Id = dish2Res.body.data.id;

  const dailyRes = await ctx.api('PUT', '/merchant/menus/2026-11-13', {
    token,
    body: {
      requestId: 'menu-filter-daily-1',
      shopId: shop1Id,
      dishes: [{ dishId: DISH, availableQuantity: 7 }],
    },
  });
  assert.equal(dailyRes.status, 200);

  const byShop1 = await ctx.api('GET', `/menu?date=2026-11-13&shopId=${encodeURIComponent(shop1Id)}`);
  assert.equal(byShop1.status, 200);
  assert.deepEqual(
    byShop1.body.data.dishes.map((item) => ({ id: item.id, qty: item.availableQuantity })),
    [{ id: DISH, qty: 7 }],
  );

  const byShop2 = await ctx.api('GET', `/menu?date=2026-11-13&shopId=${encodeURIComponent(shop2Id)}`);
  assert.equal(byShop2.status, 200);
  assert.deepEqual(
    byShop2.body.data.dishes.map((item) => item.id),
    [dish2Id],
  );

  const byMerchant2 = await ctx.api('GET', `/menu?date=2026-11-13&merchantId=${encodeURIComponent(shop2MerchantId)}`);
  assert.equal(byMerchant2.status, 200);
  assert.deepEqual(
    byMerchant2.body.data.dishes.map((item) => item.id),
    [dish2Id],
  );

  const mismatch = await ctx.api(
    'GET',
    `/menu?date=2026-11-13&merchantId=demo-merchant-01&shopId=${encodeURIComponent(shop2Id)}`,
  );
  assert.equal(mismatch.status, 200);
  assert.deepEqual(mismatch.body.data.dishes, []);

  const missingShop = await ctx.api('GET', '/menu?date=2026-11-13&shopId=nonexistent-shop');
  assert.equal(missingShop.status, 200);
  assert.deepEqual(missingShop.body.data.dishes, []);

  const emptyShop = await ctx.api('GET', '/menu?date=2026-11-13&shopId=');
  assert.equal(emptyShop.status, 400);
  assert.equal(emptyShop.body.error.code, 'VALIDATION_ERROR');
});