import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  DEMO_ORDER_001,
  DEMO_ORDER_COMPLETED_003,
} from '../src/modules/student/data/sampleData.ts';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('toOrderStatusView and OrderDetailPage hide cancel button for COMPLETED and CANCELLED orders', async () => {
  const server = await createServer({
    configFile: false,
    root: mobileRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { toOrderStatusView } = await server.ssrLoadModule('/src/modules/student/utils/orderStatusView.ts');
    for (const status of ['NEW', 'ACCEPTED', 'PREPARING', 'READY']) {
      const view = toOrderStatusView({ ...DEMO_ORDER_001, status });
      assert.equal(view.canShowCancelAction, true, `expected canShowCancelAction=true for ${status}`);
    }

    const completedView = toOrderStatusView(DEMO_ORDER_COMPLETED_003);
    assert.equal(completedView.status, 'COMPLETED');
    assert.equal(completedView.canShowCancelAction, false);

    const cancelledView = toOrderStatusView({ ...DEMO_ORDER_001, status: 'CANCELLED' });
    assert.equal(cancelledView.status, 'CANCELLED');
    assert.equal(cancelledView.canShowCancelAction, false);

    const detailPageSource = readFileSync(
      resolve(mobileRoot, 'src/modules/student/pages/OrderDetailPage.tsx'),
      'utf8',
    );
    assert.match(detailPageSource, /statusView\.canShowCancelAction\s*\?\s*\(/);
  } finally {
    await server.close();
  }
});
