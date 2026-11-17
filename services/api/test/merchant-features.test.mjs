import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { createDatabase } from '../src/db.mjs';
import { DISH, SLOT_TODAY, SLOT_TOMORROW, orderBody, startTestServer } from './helpers.mjs';

const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`;

let ctx;

beforeEach(async () => {
  ctx = await startTestServer();
});

afterEach(async () => {
  await ctx.close();
});

async function registerAndLoginMerchant(account = 'self_merchant_01', password = 'merchant-pass-123') {
  const reg = await ctx.api('POST', '/auth/merchant-register', {
    body: { account, password, displayName: '自营美食' },
  });
  assert.equal(reg.status, 201);
  assert.deepEqual(reg.body.data, { registered: true, role: 'MERCHANT' });

  const login = await ctx.api('POST', '/auth/login', { body: { account, password } });
  assert.equal(login.status, 200);
  const token = login.body.data.token;

  const merchantReg = await ctx.api('POST', '/merchant/registration', {
    token,
    body: {
      requestId: `${account}-reg`,
      merchantName: '自营美食档口',
      contactName: '李老板',
      contactPhone: '13900139000',
    },
  });
  assert.equal(merchantReg.status, 201);
  return { token, login: login.body.data, profile: merchantReg.body.data };
}

test('商家账号自助注册可用并可完整开店、建菜与接单', async () => {
  const studentReg = await ctx.api('POST', '/auth/student-register', {
    body: { account: 'taken_user', password: 'student-pass-123' },
  });
  assert.equal(studentReg.status, 201);

  const dup = await ctx.api('POST', '/auth/merchant-register', {
    body: { account: 'TAKEN_USER', password: 'merchant-pass-123' },
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'ACCOUNT_TAKEN');

  const privilege = await ctx.api('POST', '/auth/merchant-register', {
    body: { account: 'bad_role_m', password: 'merchant-pass-123', role: 'ADMIN' },
  });
  assert.equal(privilege.status, 400);
  assert.equal(privilege.body.error.code, 'INVALID_LOCATION_PAYLOAD');

  const reg = await ctx.api('POST', '/auth/merchant-register', {
    body: { account: 'ShopOwner_01', password: 'merchant-pass-123', displayName: '春风小馆' },
  });
  assert.equal(reg.status, 201);

  const login = await ctx.api('POST', '/auth/login', {
    body: { account: 'shopowner_01', password: 'merchant-pass-123' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'MERCHANT');
  assert.match(login.body.data.user.merchantId, /^m_/);
  const token = login.body.data.token;

  const profileBefore = await ctx.api('GET', '/merchant/profile', { token });
  assert.equal(profileBefore.status, 200);
  assert.equal(profileBefore.body.data.onboardingStep, 'UNREGISTERED');

  // 未完成商家资料登记前，不能在学生店铺列表出现，也不能直接开店
  const student = await ctx.login('student');
  const shopsBefore = await ctx.api('GET', '/merchants', { token: student });
  assert.equal(shopsBefore.body.data.merchants.length, 2);

  const prematureShop = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'premature-shop', shopName: '春风一店', location: '二食堂 1 楼' },
  });
  assert.equal(prematureShop.status, 409);
  assert.equal(prematureShop.body.error.code, 'MERCHANT_NOT_REGISTERED');

  const regMerchant = await ctx.api('POST', '/merchant/registration', {
    token,
    body: {
      requestId: 'self-m-reg-1',
      merchantName: '春风小馆',
      contactName: '王老板',
      contactPhone: '13911112222',
    },
  });
  assert.equal(regMerchant.status, 201);
  assert.equal(regMerchant.body.data.merchant.openAt, '08:00');
  assert.equal(regMerchant.body.data.merchant.closeAt, '22:00');

  const shop = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'self-shop-1', shopName: '春风一店', location: '二食堂 1 楼', description: '现炒现卖' },
  });
  assert.equal(shop.status, 201);

  const dish = await ctx.api('POST', '/merchant/menu', {
    token,
    body: {
      requestId: 'self-dish-1',
      type: 'STAPLE',
      name: '黑椒牛柳饭',
      priceFen: 1900,
      availableQuantity: 10,
    },
  });
  assert.equal(dish.status, 201);

  const shopsAfter = await ctx.api('GET', '/merchants', { token: student });
  const listedShop = shopsAfter.body.data.merchants.find((item) => item.name === '春风一店');
  assert.ok(listedShop);
  assert.equal(listedShop.openAt, '08:00');
  assert.equal(listedShop.closeAt, '22:00');
  assert.equal(listedShop.active, true);
});

test('菜品图片上传与回读（dataUrl / 二进制 / multipart）及魔数校验', async () => {
  const { token } = await registerAndLoginMerchant('img_merchant');

  // 1. JSON dataUrl 上传
  const uploadedJson = await ctx.api('POST', '/merchant/images', {
    token,
    body: { requestId: 'img-up-1', dataUrl: VALID_PNG_DATA_URL },
  });
  assert.equal(uploadedJson.status, 201);
  assert.match(uploadedJson.body.data.imageUrl, /^\/api\/v1\/images\/img_/);
  assert.equal(uploadedJson.body.data.mimeType, 'image/png');

  // 幂等重试返回相同图片
  const retryJson = await ctx.api('POST', '/merchant/images', {
    token,
    body: { requestId: 'img-up-1', dataUrl: VALID_PNG_DATA_URL },
  });
  assert.equal(retryJson.status, 201);
  assert.equal(retryJson.body.data.id, uploadedJson.body.data.id);

  // 公开读取图片二进制
  const origin = ctx.base.replace(/\/api\/v1$/, '');
  const fetched = await fetch(`${origin}${uploadedJson.body.data.imageUrl}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.headers.get('content-type'), 'image/png');
  assert.equal(fetched.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await fetched.arrayBuffer());
  assert.deepEqual(bytes, VALID_PNG_BUFFER);

  // 2. 原始二进制上传
  const rawRes = await fetch(`${ctx.base}/merchant/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/png',
    },
    body: VALID_PNG_BUFFER,
  });
  assert.equal(rawRes.status, 201);
  const rawPayload = await rawRes.json();
  assert.match(rawPayload.data.imageUrl, /^\/api\/v1\/images\/img_/);

  // 3. multipart/form-data 上传
  const form = new FormData();
  form.append('file', new Blob([VALID_PNG_BUFFER], { type: 'image/png' }), 'dish.png');
  const multiRes = await fetch(`${ctx.base}/merchant/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(multiRes.status, 201);
  const multiPayload = await multiRes.json();
  assert.match(multiPayload.data.imageUrl, /^\/api\/v1\/images\/img_/);

  // 4. 伪造图片魔数被拒绝
  const fakeRes = await ctx.api('POST', '/merchant/images', {
    token,
    body: { dataUrl: `data:image/png;base64,${Buffer.from('not-a-png-file-at-all').toString('base64')}` },
  });
  assert.equal(fakeRes.status, 400);
  assert.equal(fakeRes.body.error.code, 'VALIDATION_ERROR');
});

test('菜品口味组、固定配菜、加购项持久化及学生按定制下单服务端计价', async () => {
  const { token } = await registerAndLoginMerchant('cx_merchant');
  const shop = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'cx-shop', shopName: '川味面馆', location: '一食堂 2 号' },
  });
  assert.equal(shop.status, 201);

  const created = await ctx.api('POST', '/merchant/menu', {
    token,
    body: {
      requestId: 'cx-dish-1',
      type: 'STAPLE',
      name: '红烧牛肉面',
      priceFen: 1500,
      availableQuantity: 10,
      imageUrl: VALID_PNG_DATA_URL,
      flavorGroups: [
        {
          id: 'grp-spice',
          name: '辣度',
          required: true,
          options: [
            { id: 'opt-mild', name: '微辣' },
            { id: 'opt-hot', name: '特辣' },
          ],
        },
      ],
      sides: [{ id: 'side-scallion', name: '多葱花' }],
      addOns: [{ id: 'addon-egg', name: '荷包蛋', priceFen: 250 }],
    },
  });
  assert.equal(created.status, 201);
  assert.match(created.body.data.imageUrl, /^\/api\/v1\/images\/img_/);
  assert.equal(created.body.data.flavorGroups.length, 1);
  assert.equal(created.body.data.sides[0].name, '多葱花');
  assert.equal(created.body.data.addOns[0].priceFen, 250);

  // 编辑菜品更新加购项与口味组
  const updated = await ctx.api('PUT', `/merchant/menu/${created.body.data.id}`, {
    token,
    body: {
      requestId: 'cx-dish-update',
      expectedVersion: 1,
      name: '红烧牛肉面',
      type: 'STAPLE',
      priceFen: 1500,
      availableQuantity: 10,
      onSale: true,
      addOns: [
        { id: 'addon-egg', name: '荷包蛋', priceFen: 250 },
        { id: 'addon-beef', name: '加牛肉', priceFen: 600 },
      ],
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.addOns.length, 2);
  assert.equal(updated.body.data.flavorGroups.length, 1);

  // GET /menu 返回图片与定制项
  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  const dishInMenu = menu.body.data.dishes.find((d) => d.id === created.body.data.id);
  assert.equal(dishInMenu.imageUrl, created.body.data.imageUrl);
  assert.equal(dishInMenu.flavorGroups[0].options.length, 2);

  // 学生未选必选口味组会被拒绝
  const student = await ctx.login('student');
  const missingFlavor = await ctx.api('POST', '/orders', {
    token: student,
    body: {
      requestId: 'cx-order-invalid',
      items: [{ dishId: created.body.data.id, quantity: 1 }],
      slotId: SLOT_TODAY,
      diningMode: 'DINE_IN',
    },
  });
  assert.equal(missingFlavor.status, 400);

  // 同订单内对同一道菜提交两种不同定制，服务端正确算价并合并扣减库存
  const ordered = await ctx.api('POST', '/orders', {
    token: student,
    body: {
      requestId: 'cx-order-ok',
      items: [
        {
          dishId: created.body.data.id,
          quantity: 1,
          selectedFlavors: [{ groupId: 'grp-spice', optionId: 'opt-mild' }],
          selectedSides: ['side-scallion'],
          selectedAddOns: ['addon-egg', 'addon-beef'],
        },
        {
          dishId: created.body.data.id,
          quantity: 2,
          selectedFlavors: [{ groupId: 'grp-spice', optionId: 'opt-hot' }],
        },
      ],
      slotId: SLOT_TODAY,
      diningMode: 'TAKEAWAY',
    },
  });
  assert.equal(ordered.status, 201);
  // 1500 + 250 + 600 = 2350 (x1) + 1500 (x2) = 5350
  assert.equal(ordered.body.data.totalFen, 5350);
  assert.equal(ordered.body.data.items.length, 2);
  assert.equal(ordered.body.data.items[0].unitPriceFen, 2350);
  assert.equal(ordered.body.data.items[0].customization.flavorSelections[0].optionName, '微辣');
  assert.equal(ordered.body.data.items[0].customization.addOns.length, 2);
  assert.equal(ordered.body.data.items[1].unitPriceFen, 1500);

  const dishAfter = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get(created.body.data.id);
  assert.equal(dishAfter.available_quantity, 7);
});

test('菜品库 GET /merchant/dishes 与制作今日菜单 PUT /merchant/menus/{date}', async () => {
  const token = await ctx.login('merchant');
  const libraryRes = await ctx.api('GET', '/merchant/dishes', { token });
  assert.equal(libraryRes.status, 200);
  assert.equal(libraryRes.body.data.dishes.length, 2); // demo-dish-01, demo-dish-03

  // 仅上架 demo-dish-01 到今天，库存设为 3；明天不设置，保持菜品库默认
  const setToday = await ctx.api('PUT', '/merchant/menus/2026-11-13', {
    token,
    body: {
      requestId: 'daily-menu-1',
      dishes: [{ dishId: 'demo-dish-01', availableQuantity: 3 }],
    },
  });
  assert.equal(setToday.status, 200);
  assert.equal(setToday.body.data.dishes.length, 1);
  assert.equal(setToday.body.data.dishes[0].id, 'demo-dish-01');
  assert.equal(setToday.body.data.dishes[0].availableQuantity, 3);

  const todayMenu = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(todayMenu.body.data.dishes.some((d) => d.id === 'demo-dish-01'), true);
  assert.equal(todayMenu.body.data.dishes.some((d) => d.id === 'demo-dish-03'), false);
  assert.equal(todayMenu.body.data.dishes.find((d) => d.id === 'demo-dish-01').availableQuantity, 3);

  // 明天菜单未单独设置，仍包含 demo-dish-03，且 demo-dish-01 库存仍为菜品库 20
  const tomorrowMenu = await ctx.api('GET', '/menu?date=2026-11-14');
  assert.equal(tomorrowMenu.body.data.dishes.some((d) => d.id === 'demo-dish-03'), true);
  assert.equal(tomorrowMenu.body.data.dishes.find((d) => d.id === 'demo-dish-01').availableQuantity, 20);

  // 今天下单未上架的 demo-dish-03 被拒绝
  const student = await ctx.login('student');
  const unlistedOrder = await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('daily-unlisted', { items: [{ dishId: 'demo-dish-03', quantity: 1 }] }),
  });
  assert.equal(unlistedOrder.status, 409);
  assert.equal(unlistedOrder.body.error.code, 'OUT_OF_STOCK');

  // 今天下单 demo-dish-01 扣减今日库存（3 -> 1），不动菜品库（仍 20）
  const listedOrder = await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('daily-listed', { items: [{ dishId: 'demo-dish-01', quantity: 2 }] }),
  });
  assert.equal(listedOrder.status, 201);
  const libRow = ctx.db.prepare('SELECT available_quantity FROM dishes WHERE id = ?').get('demo-dish-01');
  assert.equal(libRow.available_quantity, 20);
  const todayAfterOrder = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(todayAfterOrder.body.data.dishes.find((d) => d.id === 'demo-dish-01').availableQuantity, 1);

  // 未开始制作取消恢复今日库存（1 -> 3）
  const cancelled = await ctx.api('POST', `/orders/${listedOrder.body.data.id}/cancel`, {
    token: student,
    body: { requestId: 'daily-cancel-1', expectedVersion: 1, reason: '换菜' },
  });
  assert.equal(cancelled.status, 200);
  const todayAfterCancel = await ctx.api('GET', '/menu?date=2026-11-13');
  assert.equal(todayAfterCancel.body.data.dishes.find((d) => d.id === 'demo-dish-01').availableQuantity, 3);

  // 跨店菜品不能加入本档口每日菜单
  const crossDish = await ctx.api('PUT', '/merchant/menus/2026-11-13', {
    token,
    body: {
      requestId: 'daily-menu-cross',
      dishes: [{ dishId: 'demo-dish-02', availableQuantity: 5 }],
    },
  });
  assert.equal(crossDish.status, 404);
  assert.equal(crossDish.body.error.code, 'DISH_NOT_FOUND');
});

test('商家资料与店铺资料编辑、版本冲突及营业时间/营业开关控制', async () => {
  const { token } = await registerAndLoginMerchant('edit_merchant');
  const created = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'edit-shop-create', shopName: '老味道一店', location: '一食堂 3 号' },
  });
  assert.equal(created.status, 201);
  const shopId = created.body.data.shop.id;

  // 修改商家资料
  const profileUpdated = await ctx.api('PATCH', '/merchant/profile', {
    token,
    body: { requestId: 'edit-profile-1', contactName: '张大厨', contactPhone: '13700137000' },
  });
  assert.equal(profileUpdated.status, 200);
  assert.equal(profileUpdated.body.data.merchant.contactName, '张大厨');
  assert.equal(profileUpdated.body.data.merchant.contactPhone, '137****7000');

  // 修改店铺资料
  const shopUpdated = await ctx.api('PATCH', `/merchant/shops/${shopId}`, {
    token,
    body: {
      requestId: 'edit-shop-1',
      expectedVersion: 1,
      shopName: '新味道旗舰店',
      location: '一食堂二楼 5 号',
      description: '每天现炖老火汤',
    },
  });
  assert.equal(shopUpdated.status, 200);
  assert.equal(shopUpdated.body.data.shop.name, '新味道旗舰店');
  assert.equal(shopUpdated.body.data.shop.version, 2);

  // 旧版本冲突
  const staleShop = await ctx.api('PUT', `/merchant/shops/${shopId}`, {
    token,
    body: {
      requestId: 'edit-shop-stale',
      expectedVersion: 1,
      shopName: '过期覆盖',
    },
  });
  assert.equal(staleShop.status, 409);
  assert.equal(staleShop.body.error.code, 'SHOP_VERSION_CONFLICT');

  // 营业时间与营业开关修改（先关闭店铺，此时当前时间 10:00，调整到 11:00-14:00 且 active=false）
  const dish = await ctx.api('POST', '/merchant/menu', {
    token,
    body: { requestId: 'edit-dish-1', type: 'STAPLE', name: '老火靓汤饭', priceFen: 2000, availableQuantity: 5 },
  });
  assert.equal(dish.status, 201);

  const closedHours = await ctx.api('PUT', `/merchant/shops/${shopId}/business-hours`, {
    token,
    body: { requestId: 'hours-1', openAt: '11:00', closeAt: '14:00', active: false },
  });
  assert.equal(closedHours.status, 200);
  assert.equal(closedHours.body.data.openAt, '11:00');
  assert.equal(closedHours.body.data.closeAt, '14:00');
  assert.equal(closedHours.body.data.active, false);

  const student = await ctx.login('student');
  const merchantsWhileClosed = await ctx.api('GET', '/merchants', { token: student });
  const targetShop = merchantsWhileClosed.body.data.merchants.find((m) => m.shopId === shopId);
  assert.equal(targetShop.active, false);
  assert.equal(targetShop.orderable, false);
  assert.equal(targetShop.name, '新味道旗舰店');

  const blockedOrder = await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('hours-blocked-order', { items: [{ dishId: dish.body.data.id, quantity: 1 }] }),
  });
  assert.equal(blockedOrder.status, 409);
  assert.equal(blockedOrder.body.error.code, 'MERCHANT_CLOSED');

  // 重新开启营业并将营业时间设为 09:00-21:30
  const reopenedHours = await ctx.api('PATCH', '/merchant/shop/business-hours', {
    token,
    body: { requestId: 'hours-2', openAt: '09:00', closeAt: '21:30', active: true },
  });
  assert.equal(reopenedHours.status, 200);
  assert.equal(reopenedHours.body.data.active, true);

  const merchantsOpen = await ctx.api('GET', '/merchants', { token: student });
  const openShop = merchantsOpen.body.data.merchants.find((m) => m.shopId === shopId);
  assert.equal(openShop.active, true);
  assert.equal(openShop.orderable, true);

  const okOrder = await ctx.api('POST', '/orders', {
    token: student,
    body: orderBody('hours-open-order', { items: [{ dishId: dish.body.data.id, quantity: 1 }] }),
  });
  assert.equal(okOrder.status, 201);

  // 非法营业时间返回 400
  const invalidHours = await ctx.api('PUT', `/merchant/shops/${shopId}/business-hours`, {
    token,
    body: { requestId: 'hours-bad', openAt: '21:00', closeAt: '09:00' },
  });
  assert.equal(invalidHours.status, 400);
});

test('钱包结算、提现、并发防超额提现与幂等重试', async () => {
  const merchantToken = await ctx.login('merchant');
  const studentToken = await ctx.login('student');

  // 下单两笔，一笔取消、一笔核销完成
  const order1 = await ctx.api('POST', '/orders', {
    token: studentToken,
    body: orderBody('wallet-o1', { items: [{ dishId: DISH, quantity: 2 }] }), // 3600 分
  });
  const order2 = await ctx.api('POST', '/orders', {
    token: studentToken,
    body: orderBody('wallet-o2', { items: [{ dishId: DISH, quantity: 1 }] }), // 1800 分
  });
  assert.equal(order1.status, 201);
  assert.equal(order2.status, 201);

  // 未核销前：余额 0，待结算 5400
  const walletPending = await ctx.api('GET', '/merchant/wallet', { token: merchantToken });
  assert.equal(walletPending.status, 200);
  assert.equal(walletPending.body.data.balanceFen, 0);
  assert.equal(walletPending.body.data.pendingSettlementFen, 5400);

  // 取消 order2
  await ctx.api('POST', `/orders/${order2.body.data.id}/cancel`, {
    token: studentToken,
    body: { requestId: 'wallet-cancel-2', expectedVersion: 1, reason: '不吃了' },
  });

  // 推进 order1 到 READY 并核销 COMPLETED
  await ctx.api('POST', `/merchant/orders/${order1.body.data.id}/advance`, {
    token: merchantToken,
    body: { requestId: 'w-adv-1', expectedVersion: 1, action: 'ACCEPT' },
  });
  await ctx.api('POST', `/merchant/orders/${order1.body.data.id}/advance`, {
    token: merchantToken,
    body: { requestId: 'w-adv-2', expectedVersion: 2, action: 'START_PREPARING' },
  });
  await ctx.api('POST', `/merchant/orders/${order1.body.data.id}/advance`, {
    token: merchantToken,
    body: { requestId: 'w-adv-3', expectedVersion: 3, action: 'MARK_READY' },
  });
  const detail = await ctx.api('GET', `/orders/${order1.body.data.id}`, { token: studentToken });
  const verified = await ctx.api('POST', `/merchant/orders/${order1.body.data.id}/verify`, {
    token: merchantToken,
    body: { requestId: 'w-ver-1', expectedVersion: 4, pickupCode: detail.body.data.pickupCode },
  });
  assert.equal(verified.status, 200);

  // 核销后余额 3600，待结算 0
  const walletAfterVerify = await ctx.api('GET', '/merchant/wallet', { token: merchantToken });
  assert.equal(walletAfterVerify.body.data.balanceFen, 3600);
  assert.equal(walletAfterVerify.body.data.totalIncomeFen, 3600);
  assert.equal(walletAfterVerify.body.data.pendingSettlementFen, 0);
  assert.equal(walletAfterVerify.body.data.entries.length, 1);
  assert.equal(walletAfterVerify.body.data.entries[0].kind, 'income');

  // 超额提现返回 409 INSUFFICIENT_BALANCE
  const overdraw = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token: merchantToken,
    body: { requestId: 'w-over-1', amountFen: 4000 },
  });
  assert.equal(overdraw.status, 409);
  assert.equal(overdraw.body.error.code, 'INSUFFICIENT_BALANCE');

  // 正常提现 1000，同 requestId 重试幂等
  const w1 = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token: merchantToken,
    body: { requestId: 'w-draw-1', amountFen: 1000 },
  });
  assert.equal(w1.status, 201);
  assert.equal(w1.body.data.balanceFen, 2600);

  const w1Retry = await ctx.api('POST', '/merchant/wallet/withdraw', {
    token: merchantToken,
    body: { requestId: 'w-draw-1', amountFen: 1000 },
  });
  assert.equal(w1Retry.status, 201);
  assert.equal(w1Retry.body.data.balanceFen, 2600);

  // 并发两次提现剩余全额 2600，至多成功一次
  const race = await Promise.all([
    ctx.api('POST', '/merchant/wallet/withdraw', {
      token: merchantToken,
      body: { requestId: 'w-race-1', amountFen: 2600 },
    }),
    ctx.api('POST', '/merchant/wallet/withdraw', {
      token: merchantToken,
      body: { requestId: 'w-race-2', amountFen: 2600 },
    }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);

  const walletFinal = await ctx.api('GET', '/merchant/wallet', { token: merchantToken });
  assert.equal(walletFinal.body.data.balanceFen, 0);
  assert.equal(walletFinal.body.data.totalWithdrawnFen, 3600);
});

test('同一商家账号开立多家店铺、分别建菜、切换选中及跨店隔离', async () => {
  const { token } = await registerAndLoginMerchant('multi_owner');

  const shop1Res = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'ms-1', shopName: '一食堂分店', location: '一食堂 8 号' },
  });
  const shop2Res = await ctx.api('POST', '/merchant/shops', {
    token,
    body: { requestId: 'ms-2', shopName: '二食堂分店', location: '二食堂 2 号', openAt: '07:30', closeAt: '21:00' },
  });
  assert.equal(shop1Res.status, 201);
  assert.equal(shop2Res.status, 201);

  const shop1Id = shop1Res.body.data.shop.id;
  const shop2Id = shop2Res.body.data.shop.id;
  assert.notEqual(shop1Id, shop2Id);
  assert.notEqual(shop1Res.body.data.shop.merchantId, shop2Res.body.data.shop.merchantId);

  const shopsList = await ctx.api('GET', '/merchant/shops', { token });
  assert.equal(shopsList.status, 200);
  assert.equal(shopsList.body.data.shops.length, 2);

  // 分别为两家店加菜
  const dish1 = await ctx.api('POST', '/merchant/menu', {
    token,
    body: { requestId: 'ms-d1', shopId: shop1Id, type: 'STAPLE', name: '一店盖饭', priceFen: 1600, availableQuantity: 10 },
  });
  const dish2 = await ctx.api('POST', '/merchant/menu', {
    token,
    body: { requestId: 'ms-d2', shopId: shop2Id, type: 'SNACK', name: '二店煎饼', priceFen: 900, availableQuantity: 15 },
  });
  assert.equal(dish1.status, 201);
  assert.equal(dish2.status, 201);
  assert.equal(dish1.body.data.shopId, shop1Id);
  assert.equal(dish2.body.data.shopId, shop2Id);

  // 按 shopId 过滤菜品库
  const shop2Dishes = await ctx.api('GET', `/merchant/dishes?shopId=${encodeURIComponent(shop2Id)}`, { token });
  assert.equal(shop2Dishes.status, 200);
  assert.equal(shop2Dishes.body.data.dishes.length, 1);
  assert.equal(shop2Dishes.body.data.dishes[0].id, dish2.body.data.id);

  // 切换默认激活店铺为 shop2
  const switched = await ctx.api('POST', `/merchant/shops/${shop2Id}/select`, { token });
  assert.equal(switched.status, 200);
  assert.equal(switched.body.data.activeShopId, shop2Id);
  const meAfterSwitch = await ctx.api('GET', '/me', { token });
  assert.equal(meAfterSwitch.body.data.user.merchantId, shop2Res.body.data.shop.merchantId);

  // 学生端可见两家分店，不能混店下单，但可分别下单且同一商家账号均可看到并接单
  const student = await ctx.login('student');
  const studentMerchants = await ctx.api('GET', '/merchants', { token: student });
  assert.ok(studentMerchants.body.data.merchants.some((m) => m.shopId === shop1Id && m.name === '一食堂分店'));
  assert.ok(studentMerchants.body.data.merchants.some((m) => m.shopId === shop2Id && m.name === '二食堂分店'));

  const mixedOrder = await ctx.api('POST', '/orders', {
    token: student,
    body: {
      requestId: 'ms-mixed',
      items: [
        { dishId: dish1.body.data.id, quantity: 1 },
        { dishId: dish2.body.data.id, quantity: 1 },
      ],
      slotId: SLOT_TODAY,
      diningMode: 'DINE_IN',
    },
  });
  assert.equal(mixedOrder.status, 400);

  const orderShop2 = await ctx.api('POST', '/orders', {
    token: student,
    body: {
      requestId: 'ms-o2',
      items: [{ dishId: dish2.body.data.id, quantity: 2 }],
      slotId: SLOT_TODAY,
      diningMode: 'TAKEAWAY',
    },
  });
  assert.equal(orderShop2.status, 201);
  assert.equal(orderShop2.body.data.shopId, shop2Id);
  assert.equal(orderShop2.body.data.merchantName, '二食堂分店');

  const merchantOrders = await ctx.api('GET', `/merchant/orders?shopId=${encodeURIComponent(shop2Id)}`, { token });
  assert.equal(merchantOrders.body.data.total, 1);
  assert.equal(merchantOrders.body.data.orders[0].id, orderShop2.body.data.id);

  const acceptShop2 = await ctx.api('POST', `/merchant/orders/${orderShop2.body.data.id}/advance`, {
    token,
    body: { requestId: 'ms-adv-2', expectedVersion: 1, action: 'ACCEPT' },
  });
  assert.equal(acceptShop2.status, 200);
  assert.equal(acceptShop2.body.data.status, 'ACCEPTED');

  // 另一商家账号不能访问或修改本商家的店铺
  const otherToken = await ctx.login('merchant');
  const forbiddenShop = await ctx.api('PATCH', `/merchant/shops/${shop2Id}`, {
    token: otherToken,
    body: { requestId: 'other-edit', shopName: '偷改店名' },
  });
  assert.equal(forbiddenShop.status, 404);
  assert.equal(forbiddenShop.body.error.code, 'SHOP_NOT_FOUND');
});

test('旧版 SQLite 数据库（shops.merchant_id UNIQUE 与旧 order_items）原地迁移无损升级', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'xiu-migrate-'));
  const dbFile = path.join(tempDir, 'legacy.sqlite');
  try {
    const legacyDb = new DatabaseSync(dbFile);
    legacyDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        account TEXT NOT NULL UNIQUE,
        password_stored TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        student_id TEXT,
        merchant_id TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE merchants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        open_at TEXT NOT NULL,
        close_at TEXT NOT NULL,
        contact_name TEXT,
        contact_phone TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at INTEGER
      );
      CREATE TABLE shops (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id),
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE dishes (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'STAPLE',
        name TEXT NOT NULL,
        price_fen INTEGER NOT NULL,
        available_quantity INTEGER NOT NULL,
        on_sale INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE slots (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        start_at INTEGER NOT NULL,
        end_at INTEGER NOT NULL,
        capacity INTEGER NOT NULL,
        booked_count INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        dining_mode TEXT NOT NULL,
        total_fen INTEGER NOT NULL,
        status TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE order_items (
        order_id TEXT NOT NULL,
        dish_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_fen INTEGER NOT NULL,
        merchant_id TEXT NOT NULL,
        PRIMARY KEY (order_id, dish_id)
      );
    `);
    legacyDb.prepare("INSERT INTO users VALUES ('u1', 'm1', 'x:y', 'M1', 'MERCHANT', NULL, 'm_1', 1)").run();
    legacyDb.prepare("INSERT INTO merchants VALUES ('m_1', '老店', '08:00', '20:00', '张三', '13800138000', 'ACTIVE', 1000)").run();
    legacyDb.prepare("INSERT INTO shops VALUES ('s_1', 'm_1', '老店一分店', '一楼', NULL, 1, 1000, 1000)").run();
    legacyDb.prepare("INSERT INTO order_items VALUES ('ord_1', 'd_1', '老菜', 1, 1200, 'm_1')").run();
    legacyDb.close();

    const upgraded = createDatabase(dbFile);
    const shopRow = upgraded.prepare("SELECT * FROM shops WHERE id = 's_1'").get();
    assert.equal(shopRow.owner_user_id, 'u1');
    assert.equal(shopRow.open_at, '08:00');
    assert.equal(shopRow.close_at, '20:00');
    assert.equal(shopRow.status, 'ACTIVE');

    const itemCols = upgraded.prepare('PRAGMA table_info(order_items)').all().map((c) => c.name);
    assert.ok(itemCols.includes('item_index'));
    assert.ok(itemCols.includes('customization_json'));
    const oldItem = upgraded.prepare("SELECT * FROM order_items WHERE order_id = 'ord_1'").get();
    assert.equal(oldItem.item_index, 0);
    assert.equal(oldItem.dish_id, 'd_1');
    upgraded.close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
