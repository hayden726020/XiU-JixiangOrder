import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('toSlotView and isSlotPast reject slots before the current slot while keeping current and future slots selectable', async () => {
  const server = await createServer({
    configFile: false,
    root: mobileRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { isSlotPast, resolveSourceNowMs, toSlotView } = await server.ssrLoadModule(
      '/src/modules/student/utils/slotView.ts',
    );
    const { createStudentSource } = await server.ssrLoadModule(
      '/src/modules/student/data/sampleSource.ts',
    );
    const { createOrderDraft } = await server.ssrLoadModule(
      '/src/modules/student/state/orderDraft.ts',
    );

    const now = new Date('2026-11-18T19:35:00+08:00');
    const pastSlot = {
      slotId: 'slot-1900',
      slotStart: '2026-11-18T19:00:00+08:00',
      slotEnd: '2026-11-18T19:30:00+08:00',
      remainingCapacity: 10,
      enabled: true,
    };
    const boundarySlot = {
      slotId: 'slot-1900-boundary',
      slotStart: '2026-11-18T19:00:00+08:00',
      slotEnd: '2026-11-18T19:30:00+08:00',
      remainingCapacity: 10,
      enabled: true,
    };
    const currentSlot = {
      slotId: 'slot-1930',
      slotStart: '2026-11-18T19:30:00+08:00',
      slotEnd: '2026-11-18T20:00:00+08:00',
      remainingCapacity: 0,
      enabled: true,
    };
    const closedFutureSlot = {
      slotId: 'slot-2000',
      slotStart: '2026-11-18T20:00:00+08:00',
      slotEnd: '2026-11-18T20:30:00+08:00',
      remainingCapacity: 10,
      enabled: false,
    };

    assert.equal(isSlotPast(pastSlot, now), true);
    assert.deepEqual(toSlotView(pastSlot, now), {
      selectable: false,
      metaText: '该时段已过',
      selectedText: '19:00—19:30',
    });

    assert.equal(
      toSlotView(boundarySlot, new Date('2026-11-18T19:30:00+08:00')).selectable,
      false,
    );

    assert.equal(isSlotPast(currentSlot, now), false);
    assert.deepEqual(toSlotView(currentSlot, now), {
      selectable: true,
      metaText: '可预约',
      selectedText: '19:30—20:00',
    });

    assert.equal(isSlotPast(closedFutureSlot, now), false);
    assert.deepEqual(toSlotView(closedFutureSlot, now), {
      selectable: false,
      metaText: '该时段已关闭',
      selectedText: '20:00—20:30',
    });

    const sampleAt1205 = createStudentSource({
      mode: 'sample',
      now: () => new Date('2026-11-13T12:05:00+08:00'),
    });
    assert.equal(resolveSourceNowMs(sampleAt1205), Date.parse('2026-11-13T12:05:00+08:00'));

    const menu = await sampleAt1205.getMenu('2026-11-13');
    const lunch = menu.slots.find((item) => item.slotId === 'demo-slot-20261113-lunch');
    const late = menu.slots.find((item) => item.slotId === 'demo-slot-20261113-late');
    assert.equal(lunch.enabled, false);
    assert.equal(late.enabled, true);

    await assert.rejects(
      () =>
        sampleAt1205.createOrder({
          requestId: 'req-past-slot-1',
          items: [{ dishId: 'demo-dish-01', quantity: 1 }],
          slotId: 'demo-slot-20261113-lunch',
          diningMode: 'DINE_IN',
        }),
      (error) => error?.code === 'SLOT_CLOSED',
    );

    const draft = createOrderDraft({ source: sampleAt1205 });
    draft.setShop('demo-merchant-01');
    draft.setSlot('demo-slot-20261113-lunch');
    assert.equal(draft.getState().slotId, 'demo-slot-20261113-lunch');
    draft.clearSlot();
    assert.equal(draft.getState().slotId, null);

    const slotDiningSource = readFileSync(
      resolve(mobileRoot, 'src/modules/student/pages/SlotDiningPage.tsx'),
      'utf8',
    );
    assert.match(slotDiningSource, /slotsToDisplay\.filter\(\(slot\)\s*=>\s*toSlotView\(slot,\s*nowMs\)\.selectable\)/);
    assert.match(slotDiningSource, /toSlotView\(slot,\s*currentMs\)\.selectable/);

    const confirmSource = readFileSync(
      resolve(mobileRoot, 'src/modules/student/pages/ConfirmPage.tsx'),
      'utf8',
    );
    assert.match(confirmSource, /toSlotView\(selectedSlot,\s*nowMs\)\.selectable/);
    assert.match(confirmSource, /toSlotView\(currentSlot,\s*currentMs\)\.selectable/);
  } finally {
    await server.close();
  }
});
