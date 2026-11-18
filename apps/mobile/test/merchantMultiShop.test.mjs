import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';

async function loadMerchantSource(apiRequest, sessionStore) {
  const path = new URL('../src/modules/merchant/data/source.ts', import.meta.url);
  const source = readFileSync(path, 'utf8');
  const transformed = await transformWithOxc(source, 'source.ts');
  const compiled = transformed.code
    .replace(/^import \{ ([^}]+) \} from "([^"]+)";$/gm, 'const { $1 } = require("$2");')
    .replace('export function createMerchantSource', 'function createMerchantSource');
  const dependencies = {
    '../../../shared/apiClient': { ApiError: class ApiError extends Error {}, apiRequest },
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
