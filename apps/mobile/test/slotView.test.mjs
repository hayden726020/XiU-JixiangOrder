import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFutureSlotStart } from '../src/modules/student/utils/slotAvailability.ts';

test('已开始的时段不可选，边界时间也不可选', () => {
  const start = '2026-11-18T11:30:00+08:00';
  assert.equal(isFutureSlotStart(start, Date.parse('2026-11-18T11:29:59+08:00')), true);
  assert.equal(isFutureSlotStart(start, Date.parse('2026-11-18T11:30:00+08:00')), false);
  assert.equal(isFutureSlotStart(start, Date.parse('2026-11-18T11:45:00+08:00')), false);
});

test('无效开始时间不可选', () => {
  assert.equal(isFutureSlotStart('bad-date', Date.parse('2026-11-18T10:00:00+08:00')), false);
});
