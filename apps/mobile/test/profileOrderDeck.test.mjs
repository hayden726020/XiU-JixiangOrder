import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('current order deck keeps active orders in pickup priority order', async () => {
  const server = await createServer({
    configFile: false,
    root: mobileRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { activeOrdersForDeck, DECK_SPRINGS, stepDeckSpring } = await server.ssrLoadModule('/src/modules/student/utils/profileOrderDeck.ts');
    const orders = [
      { id: 'old', status: 'NEW', createdAt: '2026-11-18T01:00:00Z' },
      { id: 'done', status: 'COMPLETED', createdAt: '2026-11-18T05:00:00Z' },
      { id: 'ready', status: 'READY', createdAt: '2026-11-18T02:00:00Z' },
      { id: 'newer', status: 'NEW', createdAt: '2026-11-18T03:00:00Z' },
    ];
    assert.deepEqual(activeOrdersForDeck(orders).map((order) => order.id), ['ready', 'newer', 'old']);
    assert.deepEqual(orders.map((order) => order.id), ['old', 'done', 'ready', 'newer']);
    assert.deepEqual(DECK_SPRINGS.follow, [900, 50]);
    assert.deepEqual(DECK_SPRINGS.return, [280, 16]);
    const spring = { x: 0, v: 0, t: 1, k: 280, c: 16 };
    stepDeckSpring(spring, 1 / 60);
    assert.ok(spring.x > 0 && spring.x < 1);
  } finally {
    await server.close();
  }
});
