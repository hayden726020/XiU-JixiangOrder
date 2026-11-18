import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const { createStudentSource } = await vite.ssrLoadModule('/src/modules/student/data/sampleSource.ts');

  test('样例菜单使用当前日期，开始后拒绝新订单但允许原请求重试', async () => {
    let now = Date.parse('2030-05-01T11:29:59+08:00');
    const source = createStudentSource({ mode: 'sample', now: () => new Date(now) });
    const menu = await source.getMenu('2030-05-01');
    assert.equal(menu.date, '2030-05-01');
    assert.equal(menu.slots[0].slotStart, '2030-05-01T11:30:00+08:00');
    assert.equal(menu.slots[2].enabled, false);

    const input = {
      requestId: 'sample-boundary-1',
      items: [{ dishId: 'demo-dish-01', quantity: 1 }],
      slotId: menu.slots[0].slotId,
      diningMode: 'DINE_IN',
    };
    const first = await source.createOrder(input);
    assert.equal(first.slotStart, menu.slots[0].slotStart);

    now = Date.parse('2030-05-01T11:30:00+08:00');
    const updatedMenu = await source.getMenu('2030-05-01');
    assert.equal(updatedMenu.slots[0].enabled, false);
    const retry = await source.createOrder(input);
    assert.equal(retry.id, first.id);
    await assert.rejects(
      source.createOrder({ ...input, requestId: 'sample-boundary-2' }),
      (error) => error.code === 'SLOT_CLOSED',
    );
    await assert.rejects(
      source.createOrder({ ...input, requestId: 'sample-full-slot', slotId: menu.slots[2].slotId }),
      (error) => error.code === 'SLOT_FULL',
    );
  });
} finally {
  await vite.close();
}
