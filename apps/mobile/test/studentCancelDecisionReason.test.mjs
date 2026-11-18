import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { DEMO_ORDER_CANCEL_REJECTED } from '../src/modules/student/data/sampleData.ts';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function orderPayload(cancelRequest) {
  return {
    id: 'ord_cancel_rejected',
    orderNo: 12,
    merchantId: 'demo-merchant-01',
    merchantName: '一食堂·家常档',
    items: [{ dishId: 'demo-dish-01', name: '演示鸡肉饭', quantity: 1, unitPriceFen: 1800 }],
    slotId: 'demo-slot-20261113-lunch',
    slotStart: '2026-11-13T11:30:00+08:00',
    slotEnd: '2026-11-13T12:00:00+08:00',
    diningMode: 'DINE_IN',
    totalFen: 1800,
    status: 'PREPARING',
    paymentStatus: 'SIMULATED_PAID',
    cancelRequest,
    cancellationReason: null,
    version: 3,
    createdAt: '2026-11-13T11:10:00+08:00',
    updatedAt: '2026-11-13T11:28:00+08:00',
    pickedUpAt: null,
    delay: null,
    pickupCode: null,
  };
}

test('学生端保留并展示商家拒绝取消申请的处理理由', async () => {
  const server = await createServer({
    configFile: false,
    root: mobileRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { mapOrderResponse } = await server.ssrLoadModule('/src/modules/student/data/fieldMapping.ts');
    const { deriveCancelAreaView } = await server.ssrLoadModule('/src/modules/student/utils/orderCancelView.ts');

    const mapped = mapOrderResponse(
      orderPayload({ status: 'REJECTED', reason: '临时有事', decisionReason: '餐品已下锅' }),
      { demo: false },
    );
    assert.equal(mapped.cancelRequest.status, 'REJECTED');
    assert.equal(mapped.cancelRequest.reason, '临时有事');
    assert.equal(mapped.cancelRequest.decisionReason, '餐品已下锅');

    const legacy = mapOrderResponse(
      orderPayload({ status: 'REJECTED', reason: '临时有事' }),
      { demo: false },
    );
    assert.equal(legacy.cancelRequest.decisionReason, null);

    const view = deriveCancelAreaView(mapped, { mode: 'real' });
    assert.equal(view.kind, 'rejected');
    assert.equal(view.decisionReason, '餐品已下锅');
    assert.match(view.noticeText, /档口未通过取消申请/);

    const sampleView = deriveCancelAreaView(DEMO_ORDER_CANCEL_REJECTED, { mode: 'sample' });
    assert.equal(sampleView.kind, 'rejected');
    assert.equal(sampleView.decisionReason, DEMO_ORDER_CANCEL_REJECTED.cancelRequest.decisionReason);

    const detailPageSource = readFileSync(
      resolve(mobileRoot, 'src/modules/student/pages/OrderDetailPage.tsx'),
      'utf8',
    );
    assert.match(detailPageSource, /cancelView\?\.kind === 'rejected'/);
    assert.match(detailPageSource, /商家处理理由：\{cancelView\.decisionReason/);
  } finally {
    await server.close();
  }
});