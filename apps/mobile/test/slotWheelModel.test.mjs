import assert from 'node:assert/strict';
import test from 'node:test';

import { getWheelTarget } from '../src/modules/student/utils/slotWheelModel.ts';

test('a flick coasts to a whole row without passing the available ends', () => {
  assert.equal(getWheelTarget(3.2, 5, 10), 5);
  assert.equal(getWheelTarget(3.2, -5, 10), 2);
  assert.equal(getWheelTarget(0.3, -30, 10), 0);
  assert.equal(getWheelTarget(8.6, 30, 10), 9);
});
