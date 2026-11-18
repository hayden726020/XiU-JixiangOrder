import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';

async function loadMerchantSource(apiRequest, sessionStore, apiBaseUrl = 'https://39.96.195.158/api/v1') {
  const path = new URL('../src/modules/merchant/data/source.ts', import.meta.url);
  const source = readFileSync(path, 'utf8');
  const transformed = await transformWithOxc(source, 'source.ts');
  const compiled = transformed.code
    .replace(/^import \{ ([^}]+) \} from "([^"]+)";$/gm, 'const { $1 } = require("$2");')
    .replace('export function createMerchantSource', 'function createMerchantSource');
  const normalizedBase = apiBaseUrl.replace(/\/+$/, '');
  const dependencies = {
    '../../../shared/apiClient': { ApiError: class ApiError extends Error {}, apiRequest },
    '../../../shared/config': {
      getApiBaseUrl: () => normalizedBase,
      buildApiUrl: (p) => `${normalizedBase}${p.startsWith('/') ? p : `/${p}`}`,
    },
    '../../../shared/session': {
      getSession: () => sessionStore.current,
      saveSession: (session) => { sessionStore.current = session; },
    },
    '../state/onboarding': {
      DEFAULT_SAMPLE_MERCHANT_NAME: '样例商家',
      resolveAccountMerchantName: () => '样例商家',
      resolveEffectiveMerchantName: () => '样例商家',
    },
    './sampleData': { sampleMenu: () => null, sampleOrders: () => [], sampleSlots: () => [], SAMPLE_DATES: [] },
  };
  return new Function('require', `${compiled}\nreturn createMerchantSource;`)(
    (name) => {
      assert.ok(name in dependencies, `unexpected import: ${name}`);
      return dependencies[name];
    },
  )({ mode: 'real' });
}

test('switching to a second shop loads and creates dishes for that shop', async () => {
  const requests = [];
  const sessionStore = {
    current: {
      token: 'test-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z',
      user: { id: 'u1', displayName: '商家', role: 'MERCHANT', merchantId: 'm1' },
    },
  };
  const source = await loadMerchantSource(async (path, options) => {
    requests.push({ path, options });
    if (path === '/merchant/shops/s2/select') {
      return {
        merchant: { id: 'm2', name: '二店' },
        shop: { id: 's2', merchantId: 'm2', name: '二店' },
        shops: [
          { id: 's1', merchantId: 'm1', name: '一店' },
          { id: 's2', merchantId: 'm2', name: '二店' },
        ],
        activeShopId: 's2', activeMerchantId: 'm2', onboardingStep: 'SHOP_CREATED',
      };
    }
    if (path.startsWith('/menu?')) {
      return {
        date: '2026-11-18', slots: [],
        dishes: [
          { id: 'd1', merchantId: 'm1', name: '一店菜', priceFen: 100, availableQuantity: 1, onSale: true },
          { id: 'd2', merchantId: 'm2', name: '二店菜', priceFen: 200, availableQuantity: 1, onSale: true },
        ],
      };
    }
    if (path === '/merchant/menu') {
      return { id: 'd3', merchantId: 'm2', name: '新菜', type: 'STAPLE', priceFen: 300, availableQuantity: 2, onSale: true };
    }
    throw new Error(`unexpected request: ${path}`);
  }, sessionStore);

  const selected = await source.selectShop('s2');
  assert.equal(selected.ok, true);
  assert.equal(sessionStore.current.user.merchantId, 'm2');
  const menu = await source.getMenu('2026-11-18');
  assert.equal(menu.ok, true);
  assert.deepEqual(menu.data.dishes.map((dish) => dish.name), ['二店菜']);
  const created = await source.createDish({
    requestId: 'new-dish', shopId: 's2', type: 'STAPLE', name: '新菜',
    priceFen: 300, availableQuantity: 2, onSale: true,
  });
  assert.equal(created.ok, true);
  assert.equal(requests.at(-1).options.body.shopId, 's2');
});

test('a late shop selection cannot restore a signed-out session', async () => {
  const sessionStore = {
    current: {
      token: 'old-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z',
      user: { id: 'u1', displayName: '商家', role: 'MERCHANT', merchantId: 'm1' },
    },
  };
  const source = await loadMerchantSource(async () => {
    sessionStore.current = null;
    return {
      merchant: { id: 'm2', name: '二店' },
      shop: { id: 's2', merchantId: 'm2', name: '二店' },
      activeShopId: 's2', activeMerchantId: 'm2', onboardingStep: 'SHOP_CREATED',
    };
  }, sessionStore);

  const selected = await source.selectShop('s2');
  assert.equal(selected.ok, false);
  assert.equal(selected.error.code, 'SESSION_CHANGED');
  assert.equal(sessionStore.current, null);
});

test('updateProfile submits merchantName and shopName in real mode', async () => {
  const requests = [];
  const sessionStore = {
    current: {
      token: 'test-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z',
      user: { id: 'u1', displayName: '默认账号名', role: 'MERCHANT', merchantId: 'm1' },
    },
  };
  const source = await loadMerchantSource(async (path, options) => {
    requests.push({ path, options });
    if (path === '/merchant/profile') {
      return {
        merchant: { id: 'm1', name: options.body.merchantName, contactName: options.body.contactName, contactPhone: '138****0000', status: 'ACTIVE' },
        shop: { id: 's1', merchantId: 'm1', name: '旧店名', location: '一楼', version: 1 },
        shops: [{ id: 's1', merchantId: 'm1', name: '旧店名', location: '一楼', version: 1 }],
        activeShopId: 's1', activeMerchantId: 'm1', onboardingStep: 'SHOP_CREATED',
      };
    }
    if (path === '/merchant/shops/s1') {
      return {
        merchant: { id: 'm1', name: '修改后商家名', contactName: '李四', contactPhone: '138****0000', status: 'ACTIVE' },
        shop: { id: 's1', merchantId: 'm1', name: options.body.shopName, location: options.body.location, version: 2 },
        shops: [{ id: 's1', merchantId: 'm1', name: options.body.shopName, location: options.body.location, version: 2 }],
        activeShopId: 's1', activeMerchantId: 'm1', onboardingStep: 'SHOP_CREATED',
      };
    }
    throw new Error(`unexpected request: ${path}`);
  }, sessionStore);

  const updated = await source.updateProfile({
    requestId: 'req-1',
    merchantName: '修改后商家名',
    contactName: '李四',
    shopId: 's1',
    shopVersion: 1,
    shopName: '修改后店铺名',
    location: '二楼 3 号',
    description: '新简介',
  });
  assert.equal(updated.ok, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].path, '/merchant/profile');
  assert.equal(requests[0].options.body.merchantName, '修改后商家名');
  assert.equal(requests[1].path, '/merchant/shops/s1');
  assert.equal(requests[1].options.body.shopName, '修改后店铺名');
  assert.equal(updated.data.merchant.name, '修改后商家名');
  assert.equal(updated.data.shop.name, '修改后店铺名');
});

test('createDish and updateDish sync imageUrl and customizations with API base resolution', async () => {
  const requests = [];
  const sessionStore = {
    current: {
      token: 'test-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z',
      user: { id: 'u1', displayName: '商家', role: 'MERCHANT', merchantId: 'm1' },
    },
  };
  const source = await loadMerchantSource(async (path, options) => {
    requests.push({ path, options });
    if (path === '/merchant/menu') {
      return {
        id: 'd-img-1',
        merchantId: 'm1',
        type: 'STAPLE',
        name: '照烧鸡腿饭',
        priceFen: 1600,
        availableQuantity: 20,
        onSale: true,
        version: 1,
        imageUrl: '/api/v1/images/img_uploaded_1',
        flavorGroups: options.body.flavorGroups,
        sides: options.body.sides,
        addOns: options.body.addOns,
      };
    }
    if (path === '/merchant/menu/d-img-1') {
      return {
        id: 'd-img-1',
        merchantId: 'm1',
        type: 'STAPLE',
        name: '照烧鸡腿饭',
        priceFen: 1700,
        availableQuantity: 20,
        onSale: true,
        version: 2,
        imageUrl: options.body.imageUrl,
        flavorGroups: options.body.flavorGroups,
        sides: options.body.sides,
        addOns: options.body.addOns,
      };
    }
    throw new Error(`unexpected request: ${path}`);
  }, sessionStore);

  const created = await source.createDish({
    requestId: 'create-img-1',
    shopId: 's1',
    type: 'STAPLE',
    name: '照烧鸡腿饭',
    priceFen: 1600,
    availableQuantity: 20,
    onSale: true,
    imageUrl: 'data:image/jpeg;base64,/9j/4AAQ',
    flavorGroups: [{ id: 'fg-1', name: '辣度', required: true, options: [{ id: 'opt-1', name: '微辣', priceFen: 0 }] }],
    sides: [{ id: 'side-1', name: '青菜', priceFen: 0 }],
    addOns: [{ id: 'add-1', name: '煎蛋', priceFen: 200 }],
  });
  assert.equal(created.ok, true);
  assert.equal(requests[0].options.body.imageUrl, 'data:image/jpeg;base64,/9j/4AAQ');
  assert.equal(created.data.imageUrl, 'https://39.96.195.158/api/v1/images/img_uploaded_1');
  assert.equal(created.data.flavorGroups?.length, 1);

  const updated = await source.updateDish('2026-11-18', 'd-img-1', {
    requestId: 'update-img-1',
    expectedVersion: 1,
    name: '照烧鸡腿饭',
    type: 'STAPLE',
    priceFen: 1700,
    availableQuantity: 20,
    onSale: true,
    imageUrl: created.data.imageUrl,
    flavorGroups: created.data.flavorGroups,
    sides: created.data.sides,
    addOns: created.data.addOns,
  });
  assert.equal(updated.ok, true);
  assert.equal(requests[1].options.body.imageUrl, '/api/v1/images/img_uploaded_1');
  assert.equal(updated.data.imageUrl, 'https://39.96.195.158/api/v1/images/img_uploaded_1');
});
