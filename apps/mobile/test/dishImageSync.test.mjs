import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';
import { startTestServer } from '../../../services/api/test/helpers.mjs';

const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+pW1kAAAAASUVORK5CYII=',
  'base64',
);
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`;

async function compileModule(relativePath, dependencies) {
  const path = new URL(relativePath, import.meta.url);
  const source = readFileSync(path, 'utf8');
  const transformed = await transformWithOxc(source, relativePath);
  const compiled = transformed.code
    .replace(/^import type .*$/gm, '')
    .replace(/^import \{ ([^}]+) \} from "([^"]+)";$/gm, (_, names, mod) => (
      `const { ${names.replace(/\btype\s+/g, '')} } = require("${mod}");`
    ))
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'const ')
    .replace(/^export interface [\s\S]*?^\}/gm, '');

  const exports = {};
  const fnNames = [...source.matchAll(/^export (?:function|const) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const footer = `return { ${fnNames.join(', ')} };`;
  return new Function('require', `${compiled}\n${footer}`)((name) => {
    assert.ok(name in dependencies, `unexpected import in ${relativePath}: ${name}`);
    return dependencies[name];
  });
}

test('merchant uploaded dish image is persisted to backend and visible on student menu', async () => {
  const ctx = await startTestServer();
  try {
    const loginRes = await ctx.api('POST', '/auth/demo-login', {
      body: { account: 'demo-merchant', password: 'merchant-pass-123' },
    });
    assert.equal(loginRes.status, 200);
    const sessionStore = { current: loginRes.body.data };
    const normalizedBase = ctx.base.replace(/\/+$/, '');

    class TestApiError extends Error {
      constructor({ code, message, status, retryable }) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
      }
    }

    async function apiRequest(path, options = {}) {
      const res = await fetch(`${normalizedBase}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(sessionStore.current?.token ? { Authorization: `Bearer ${sessionStore.current.token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new TestApiError({
          code: payload?.error?.code ?? 'HTTP_ERROR',
          message: payload?.error?.message ?? 'request failed',
          status: res.status,
          retryable: Boolean(payload?.error?.retryable),
        });
      }
      return payload.data;
    }

    const configStub = {
      getApiBaseUrl: () => normalizedBase,
      buildApiUrl: (p) => `${normalizedBase}${p.startsWith('/') ? p : `/${p}`}`,
    };

    const { createMerchantSource } = await compileModule('../src/modules/merchant/data/source.ts', {
      '../../../shared/apiClient': { ApiError: TestApiError, apiRequest },
      '../../../shared/config': configStub,
      '../../../shared/session': {
        getSession: () => sessionStore.current,
        saveSession: (next) => { sessionStore.current = next; },
      },
      '../state/onboarding': {
        DEFAULT_SAMPLE_MERCHANT_NAME: '样例商家',
        resolveAccountMerchantName: () => '样例商家',
        resolveEffectiveMerchantName: () => '样例商家',
      },
      './sampleData': { sampleMenu: () => null, sampleOrders: () => [], sampleSlots: () => [], SAMPLE_DATES: [] },
    });

    const { mapMenuResponse } = await compileModule('../src/modules/student/data/fieldMapping.ts', {
      '../../../shared/apiClient': { ApiError: TestApiError },
      '../../../shared/config': configStub,
    });

    const merchantSource = createMerchantSource({ mode: 'real' });
    const profile = await merchantSource.getProfile();
    assert.equal(profile.ok, true);

    const created = await merchantSource.createDish({
      requestId: 'e2e-dish-img-1',
      shopId: profile.data.activeShopId ?? undefined,
      type: 'STAPLE',
      name: '蜜汁叉烧饭',
      priceFen: 1900,
      availableQuantity: 15,
      onSale: true,
      imageUrl: VALID_PNG_DATA_URL,
      flavorGroups: [{ id: 'fg-1', name: '口味', required: true, options: [{ id: 'opt-1', name: '原味', priceFen: 0 }] }],
      sides: [{ id: 'side-1', name: '青菜', priceFen: 0 }],
      addOns: [{ id: 'add-1', name: '卤蛋', priceFen: 200 }],
    });
    assert.equal(created.ok, true);
    assert.ok(created.data.imageUrl?.startsWith(`${normalizedBase}/images/img_`));

    // Merchant edits dish price while keeping existing resolved imageUrl
    const updated = await merchantSource.updateDish('2026-11-13', created.data.dishId, {
      requestId: 'e2e-dish-img-update-1',
      expectedVersion: created.data.version,
      name: '蜜汁叉烧饭',
      type: 'STAPLE',
      priceFen: 2000,
      availableQuantity: 15,
      onSale: true,
      imageUrl: created.data.imageUrl,
      flavorGroups: created.data.flavorGroups,
      sides: created.data.sides,
      addOns: created.data.addOns,
    });
    assert.equal(updated.ok, true);
    assert.equal(updated.data.imageUrl, created.data.imageUrl);

    // Student fetches GET /menu and maps via mapMenuResponse
    const studentToken = await ctx.login('student');
    const menuRes = await ctx.api('GET', '/menu?date=2026-11-13', { token: studentToken });
    assert.equal(menuRes.status, 200);
    const studentMenu = mapMenuResponse(menuRes.body.data);
    const studentDish = studentMenu.dishes.find((d) => d.dishId === created.data.dishId);
    assert.ok(studentDish, 'student menu should contain the created dish');
    assert.equal(studentDish.imageUrl, created.data.imageUrl);
    assert.equal(studentDish.flavorGroups.length, 1);
    assert.equal(studentDish.sides.length, 1);
    assert.equal(studentDish.addOns.length, 1);

    // Student image URL is directly fetchable and returns the exact uploaded PNG bytes
    const imgRes = await fetch(studentDish.imageUrl);
    assert.equal(imgRes.status, 200);
    assert.equal(imgRes.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await imgRes.arrayBuffer()), VALID_PNG_BUFFER);
  } finally {
    await ctx.close();
  }
});
