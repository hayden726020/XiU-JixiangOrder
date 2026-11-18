import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

test('a newly created shop uses its own location for the student canteen filter', async () => {
  const server = await createServer({
    configFile: false,
    root: mobileRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { mapShopListResponse } = await server.ssrLoadModule('/src/modules/student/data/fieldMapping.ts');
    const { deriveShopCards, resolveStallVisual } = await server.ssrLoadModule('/src/modules/student/utils/shopSelectView.ts');
    const shops = mapShopListResponse({
      data: {
        merchants: [
          {
            merchantId: 'new-shop-1',
            name: '春风小馆',
            canteenId: 'canteen-01',
            location: '二食堂 2 楼',
            active: true,
            orderable: true,
          },
        ],
      },
    }, { demo: false });

    const [card] = deriveShopCards(shops, { mode: 'real' });
    const visual = resolveStallVisual(card, 0);
    assert.equal(visual.canteenGroup, '二食堂');
    assert.equal(visual.location, '二食堂 2 楼');
  } finally {
    await server.close();
  }
});
