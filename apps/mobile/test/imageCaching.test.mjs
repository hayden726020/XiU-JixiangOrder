import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import {
  getCachedMenu,
  getCachedOrders,
  getCachedShops,
  setCachedMenu,
  setCachedOrders,
  setCachedShops,
} from '../src/modules/student/state/studentDataCache.ts';
import { preloadImages } from '../src/shared/imagePreload.ts';

test('studentDataCache isolates cached shops, menus, and orders per StudentSource instance', () => {
  const sourceA = { mode: 'real' };
  const sourceB = { mode: 'sample' };

  assert.equal(getCachedShops(sourceA), null);
  assert.equal(getCachedMenu(sourceA, '2026-11-18'), null);
  assert.equal(getCachedOrders(sourceA), null);

  const shopsA = [{ merchantId: 'm1', name: '一食堂' }];
  const menuA = { date: '2026-11-18', dishes: [], slots: [] };
  const ordersA = [{ id: 'ord-1' }];

  setCachedShops(sourceA, shopsA);
  setCachedMenu(sourceA, '2026-11-18', menuA);
  setCachedOrders(sourceA, ordersA);

  assert.deepEqual(getCachedShops(sourceA), shopsA);
  assert.deepEqual(getCachedMenu(sourceA, '2026-11-18'), menuA);
  assert.equal(getCachedMenu(sourceA, '2026-11-19'), null);
  assert.deepEqual(getCachedOrders(sourceA), ordersA);

  assert.equal(getCachedShops(sourceB), null);
  assert.equal(getCachedMenu(sourceB, '2026-11-18'), null);
  assert.equal(getCachedOrders(sourceB), null);
});

test('preloadImages deduplicates URLs and handles non-browser and browser environments safely', () => {
  // Non-browser environment (current Node globals): should safely no-op.
  assert.doesNotThrow(() => preloadImages(['/assets/a.webp', null, undefined, '']));

  const created = [];
  const prevWindow = globalThis.window;
  const prevImage = globalThis.Image;
  try {
    globalThis.window = {};
    globalThis.Image = class FakeImage {
      constructor() {
        this.src = '';
        this.decoding = '';
        created.push(this);
      }
      decode() {
        return Promise.resolve();
      }
    };

    preloadImages(['/assets/hero.webp', '/assets/hero.webp', '  /assets/dish.webp  ', '', null]);
    assert.equal(created.length, 2);
    assert.equal(created[0].src, '/assets/hero.webp');
    assert.equal(created[0].decoding, 'async');
    assert.equal(created[1].src, '/assets/dish.webp');
  } finally {
    globalThis.window = prevWindow;
    globalThis.Image = prevImage;
  }
});

test('service worker caches only /assets/ and /api/v1/images/ and never caches index.html or API JSON', async () => {
  const swPath = path.resolve(import.meta.dirname, '../public/sw.js');
  const swSource = fs.readFileSync(swPath, 'utf8');

  const listeners = new Map();
  const cacheStore = new Map();
  const fakeCache = {
    async match(req) {
      return cacheStore.get(req.url) ?? undefined;
    },
    async put(req, res) {
      cacheStore.set(req.url, res);
    },
  };
  let fetchCalls = 0;
  const context = {
    URL,
    self: {
      location: { origin: 'https://39.96.195.158' },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      addEventListener: (name, fn) => listeners.set(name, fn),
    },
    caches: {
      keys: async () => ['jixiang-media-v1'],
      delete: async () => true,
      open: async () => fakeCache,
    },
    fetch: async (req) => {
      fetchCalls += 1;
      const body = `body:${req.url}`;
      return {
        ok: true,
        type: 'basic',
        clone: () => ({ ok: true, type: 'basic', body }),
        body,
      };
    },
  };

  vm.runInNewContext(swSource, context);
  const onFetch = listeners.get('fetch');
  assert.equal(typeof onFetch, 'function');

  const runFetch = (url, method = 'GET') => {
    let responded = null;
    onFetch({
      request: { url, method },
      respondWith(promise) {
        responded = promise;
      },
    });
    return responded;
  };

  // Must not intercept index.html, root, sw.js, or JSON APIs
  assert.equal(runFetch('https://39.96.195.158/'), null);
  assert.equal(runFetch('https://39.96.195.158/index.html'), null);
  assert.equal(runFetch('https://39.96.195.158/sw.js'), null);
  assert.equal(runFetch('https://39.96.195.158/api/v1/menu?date=2026-11-18'), null);

  // Must cache-first intercept /assets/* and /api/v1/images/*
  const p1 = runFetch('https://39.96.195.158/assets/campus-hero-123.webp');
  assert.ok(p1);
  const res1 = await p1;
  assert.equal(res1.body, 'body:https://39.96.195.158/assets/campus-hero-123.webp');
  assert.equal(fetchCalls, 1);

  const p2 = runFetch('https://39.96.195.158/assets/campus-hero-123.webp');
  const res2 = await p2;
  assert.equal(res2.body, 'body:https://39.96.195.158/assets/campus-hero-123.webp');
  assert.equal(fetchCalls, 1);

  const p3 = runFetch('https://39.96.195.158/api/v1/images/img_abc');
  assert.ok(p3);
  await p3;
  assert.equal(fetchCalls, 2);

  await runFetch('https://39.96.195.158/api/v1/images/img_abc');
  assert.equal(fetchCalls, 2);
});
