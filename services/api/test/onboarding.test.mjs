import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { SLOT_TODAY, startTestServer } from './helpers.mjs';

let ctx;
let newMerchant;

beforeEach(async () => {
  ctx = await startTestServer();
  ctx.addUser({
    id: 'user-new-merchant-01',
    account: 'new-merchant',
    password: 'new-merchant-pass-1',
    role: 'MERCHANT',
    displayName: '新商家',
  });
  const response = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'new-merchant', password: 'new-merchant-pass-1' },
  });
  assert.equal(response.status, 200);
  newMerchant = response.body.data.token;
});

afterEach(async () => {
  await ctx.close();
});

function registerBody(requestId, overrides = {}) {
  return {
    requestId,
    merchantName: '吉祥小馆',
    contactName: '张三',
    contactPhone: '13800138000',
    ...overrides,
  };
}

function shopBody(requestId, overrides = {}) {
  return {
    requestId,
    shopName: '吉祥小馆一店',
    location: '一食堂二楼 3 号档口',
    description: '现做现卖',
    ...overrides,
  };
}

function dishBody(requestId, overrides = {}) {
  return {
    requestId,
    type: 'STAPLE',
    name: '招牌鸡肉饭',
    priceFen: 1850,
    availableQuantity: 30,
    onSale: true,
    ...overrides,
  };
}

async function registerMerchant(token = newMerchant, requestId = 'onboarding-register-1') {
  const response = await ctx.api('POST', '/merchant/registration', {
    token,
    body: registerBody(requestId),
  });
  assert.equal(response.status, 201);
  return response.body.data;
}

async function createShop(token = newMerchant, requestId = 'onboarding-shop-1') {
  const response = await ctx.api('POST', '/merchant/shops', { token, body: shopBody(requestId) });
  assert.equal(response.status, 201);
  return response.body.data;
}

test('未登录访问商家注册接口返回 401', async () => {
  for (const [method, path, body] of [
    ['GET', '/merchant/profile', undefined],
    ['POST', '/merchant/registration', registerBody('unauth-1')],
    ['POST', '/merchant/shops', shopBody('unauth-2')],
    ['POST', '/merchant/menu', dishBody('unauth-3')],
  ]) {
    const response = await ctx.api(method, path, { body });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  }
});

test('学生与管理员访问商家注册接口返回 403', async () => {
  const student = await ctx.login('student');
  const admin = await ctx.login('admin');
  for (const token of [student, admin]) {
    for (const [method, path, body] of [
      ['GET', '/merchant/profile', undefined],
      ['POST', '/merchant/registration', registerBody('forbidden-1')],
      ['POST', '/merchant/shops', shopBody('forbidden-2')],
      ['POST', '/merchant/menu', dishBody('forbidden-3')],
    ]) {
      const response = await ctx.api(method, path, { token, body });
      assert.equal(response.status, 403, `${method} ${path}`);
      assert.equal(response.body.error.code, 'FORBIDDEN');
    }
  }
});

test('未注册档口账号 profile 返回空商家与 UNREGISTERED', async () => {
  const response = await ctx.api('GET', '/merchant/profile', { token: newMerchant });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.merchant, null);
  assert.equal(response.body.data.shop, null);
  assert.equal(response.body.data.onboardingStep, 'UNREGISTERED');
});

test('注册成功后 profile、/me 与手机号掩码同步', async () => {
  const created = await registerMerchant();
  assert.match(created.merchant.id, /^m_/);
  assert.equal(created.merchant.name, '吉祥小馆');
  assert.equal(created.merchant.status, 'ACTIVE');
  assert.equal(typeof created.merchant.createdAt, 'string');
  assert.equal(created.onboardingStep, 'REGISTERED');

  const profile = await ctx.api('GET', '/merchant/profile', { token: newMerchant });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.merchant.id, created.merchant.id);
  assert.equal(profile.body.data.merchant.name, '吉祥小馆');
  assert.equal(profile.body.data.merchant.contactName, '张三');
  assert.equal(profile.body.data.merchant.contactPhone, '138****8000');
  assert.equal(profile.body.data.shop, null);
  assert.equal(profile.body.data.onboardingStep, 'REGISTERED');

  const me = await ctx.api('GET', '/me', { token: newMerchant });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.merchantId, created.merchant.id);
});

test('同 requestId 重试注册返回首次结果，不重复创建商家', async () => {
  const first = await registerMerchant(newMerchant, 'onboarding-register-1');
  const before = ctx.db.prepare('SELECT COUNT(*) AS count FROM merchants').get().count;
  const retry = await ctx.api('POST', '/merchant/registration', {
    token: newMerchant,
    body: registerBody('onboarding-register-1'),
  });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.merchant.id, first.merchant.id);
  const after = ctx.db.prepare('SELECT COUNT(*) AS count FROM merchants').get().count;
  assert.equal(after, before);
});

test('新 requestId 重复注册返回 MERCHANT_ALREADY_REGISTERED', async () => {
  await registerMerchant();
  const again = await ctx.api('POST', '/merchant/registration', {
    token: newMerchant,
    body: registerBody('onboarding-register-2', { merchantName: '第二家店' }),
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'MERCHANT_ALREADY_REGISTERED');
});

test('联系电话重复返回 CONTACT_PHONE_TAKEN', async () => {
  ctx.addUser({
    id: 'user-new-merchant-02',
    account: 'new-merchant-2',
    password: 'new-merchant-pass-2',
    role: 'MERCHANT',
    displayName: '新商家二',
  });
  const login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'new-merchant-2', password: 'new-merchant-pass-2' },
  });
  await registerMerchant();
  const duplicated = await ctx.api('POST', '/merchant/registration', {
    token: login.body.data.token,
    body: registerBody('onboarding-register-3', { contactPhone: '138-0013-8000' }),
  });
  assert.equal(duplicated.status, 409);
  assert.equal(duplicated.body.error.code, 'CONTACT_PHONE_TAKEN');
});

test('注册字段非法返回 VALIDATION_ERROR', async () => {
  const cases = [
    registerBody('invalid-1', { merchantName: '短' }),
    registerBody('invalid-2', { contactName: '一' }),
    registerBody('invalid-3', { contactPhone: '1380013800' }),
    registerBody('invalid-4', { merchantName: 'x'.repeat(31) }),
    { ...registerBody('invalid-5'), merchantId: 'demo-merchant-02' },
  ];
  for (const body of cases) {
    const response = await ctx.api('POST', '/merchant/registration', { token: newMerchant, body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }

  const withRole = await ctx.api('POST', '/merchant/registration', {
    token: newMerchant,
    body: { ...registerBody('invalid-6'), role: 'ADMIN' },
  });
  assert.equal(withRole.status, 400);
  assert.equal(withRole.body.error.code, 'INVALID_LOCATION_PAYLOAD');
});

test('未注册账号创建店铺返回 MERCHANT_NOT_REGISTERED', async () => {
  const response = await ctx.api('POST', '/merchant/shops', {
    token: newMerchant,
    body: shopBody('onboarding-shop-before-register'),
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'MERCHANT_NOT_REGISTERED');
});

test('创建店铺成功，profile 进入 SHOP_CREATED', async () => {
  const merchant = await registerMerchant();
  const shop = await createShop();
  assert.match(shop.shop.id, /^s_/);
  assert.equal(shop.shop.merchantId, merchant.merchant.id);
  assert.equal(shop.shop.name, '吉祥小馆一店');
  assert.equal(shop.shop.location, '一食堂二楼 3 号档口');
  assert.equal(shop.shop.description, '现做现卖');
  assert.equal(shop.shop.version, 1);
  assert.equal(shop.onboardingStep, 'SHOP_CREATED');

  const profile = await ctx.api('GET', '/merchant/profile', { token: newMerchant });
  assert.equal(profile.body.data.onboardingStep, 'SHOP_CREATED');
  assert.equal(profile.body.data.shop.id, shop.shop.id);
  assert.equal(profile.body.data.shop.version, 1);
});

test('重复创建店铺返回 SHOP_ALREADY_EXISTS，同 requestId 重试仍返回首次结果', async () => {
  await registerMerchant();
  const first = await createShop(newMerchant, 'onboarding-shop-1');
  const retry = await ctx.api('POST', '/merchant/shops', {
    token: newMerchant,
    body: shopBody('onboarding-shop-1'),
  });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.shop.id, first.shop.id);

  const again = await ctx.api('POST', '/merchant/shops', {
    token: newMerchant,
    body: shopBody('onboarding-shop-2', { shopName: '吉祥小馆二店' }),
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'SHOP_ALREADY_EXISTS');
});

test('新增菜品成功，GET /menu 返回 type，学生可下单该菜', async () => {
  await registerMerchant();
  const dish = await ctx.api('POST', '/merchant/menu', {
    token: newMerchant,
    body: dishBody('onboarding-dish-1'),
  });
  assert.equal(dish.status, 201);
  assert.match(dish.body.data.id, /^dish_/);
  assert.equal(dish.body.data.type, 'STAPLE');
  assert.equal(dish.body.data.priceFen, 1850);
  assert.equal(dish.body.data.availableQuantity, 30);
  assert.equal(dish.body.data.version, 1);

  const menu = await ctx.api('GET', '/menu?date=2026-11-13');
  const listed = menu.body.data.dishes.find((item) => item.id === dish.body.data.id);
  assert.ok(listed);
  assert.equal(listed.type, 'STAPLE');
  assert.equal(listed.name, '招牌鸡肉饭');
  for (const item of menu.body.data.dishes) {
    assert.ok(['STAPLE', 'SNACK', 'DRINK', 'SET'].includes(item.type), item.id);
  }

  const student = await ctx.login('student');
  const order = await ctx.api('POST', '/orders', {
    token: student,
    body: {
      requestId: 'onboarding-order-1',
      items: [{ dishId: dish.body.data.id, quantity: 1 }],
      slotId: SLOT_TODAY,
      diningMode: 'DINE_IN',
    },
  });
  assert.equal(order.status, 201);
  assert.equal(order.body.data.items[0].dishId, dish.body.data.id);
  assert.equal(order.body.data.totalFen, 1850);
});

test('同店菜品重名返回 DISH_NAME_DUPLICATE', async () => {
  await registerMerchant();
  await ctx.api('POST', '/merchant/menu', { token: newMerchant, body: dishBody('onboarding-dish-1') });
  const duplicate = await ctx.api('POST', '/merchant/menu', {
    token: newMerchant,
    body: dishBody('onboarding-dish-2', { priceFen: 2000 }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'DISH_NAME_DUPLICATE');
});

test('新增菜品同 requestId 重试不重复创建，不同内容返回 REQUEST_CONFLICT', async () => {
  await registerMerchant();
  const first = await ctx.api('POST', '/merchant/menu', {
    token: newMerchant,
    body: dishBody('onboarding-dish-1'),
  });
  const before = ctx.db.prepare('SELECT COUNT(*) AS count FROM dishes').get().count;
  const retry = await ctx.api('POST', '/merchant/menu', {
    token: newMerchant,
    body: dishBody('onboarding-dish-1'),
  });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.id, first.body.data.id);
  const after = ctx.db.prepare('SELECT COUNT(*) AS count FROM dishes').get().count;
  assert.equal(after, before);

  const conflictResponse = await ctx.api('POST', '/merchant/menu', {
    token: newMerchant,
    body: dishBody('onboarding-dish-1', { priceFen: 1900 }),
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictResponse.body.error.code, 'REQUEST_CONFLICT');
});

test('新增菜品字段非法返回 VALIDATION_ERROR', async () => {
  await registerMerchant();
  const cases = [
    dishBody('invalid-dish-1', { type: 'BOGUS' }),
    dishBody('invalid-dish-2', { priceFen: 0 }),
    dishBody('invalid-dish-3', { availableQuantity: 10_001 }),
    dishBody('invalid-dish-4', { name: 'x'.repeat(31) }),
    dishBody('invalid-dish-5', { onSale: 'yes' }),
    { ...dishBody('invalid-dish-6'), merchantId: 'demo-merchant-02' },
  ];
  for (const body of cases) {
    const response = await ctx.api('POST', '/merchant/menu', { token: newMerchant, body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('已有 merchantId 但未注册的演示档口可补注册，重复注册返回 409', async () => {
  const token = await ctx.login('merchant');
  const profile = await ctx.api('GET', '/merchant/profile', { token });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.merchant.id, 'demo-merchant-01');
  assert.equal(profile.body.data.onboardingStep, 'UNREGISTERED');

  const registered = await ctx.api('POST', '/merchant/registration', {
    token,
    body: registerBody('demo-register-1', { merchantName: '一食堂·家常档' }),
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.data.merchant.id, 'demo-merchant-01');

  const again = await ctx.api('POST', '/merchant/registration', {
    token,
    body: registerBody('demo-register-2'),
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'MERCHANT_ALREADY_REGISTERED');
});

test('档口只能看到自己的注册状态，不能读取其他商家资料', async () => {
  await registerMerchant();
  const merchantProfile = await ctx.api('GET', '/merchant/profile', { token: newMerchant });
  assert.notEqual(merchantProfile.body.data.merchant.id, 'demo-merchant-01');

  const demoToken = await ctx.login('merchant');
  const demoProfile = await ctx.api('GET', '/merchant/profile', { token: demoToken });
  assert.equal(demoProfile.body.data.merchant.id, 'demo-merchant-01');
  assert.equal(demoProfile.body.data.onboardingStep, 'UNREGISTERED');
});