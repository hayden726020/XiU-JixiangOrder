import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeAuthError,
  validateStudentRegisterInput,
} from '../src/modules/student/utils/authView.ts';
import {
  DATES,
  DISHES,
  SLOTS,
  sampleDates,
  toDishDto,
} from '../src/modules/student/data/sampleData.ts';
import { ORDER_REMARK_MAX_LENGTH, sanitizeOrderRemark } from '../src/modules/student/utils/remark.ts';

test('sanitizeOrderRemark trims control chars and caps remark at 50 chars', () => {
  assert.equal(ORDER_REMARK_MAX_LENGTH, 50);
  assert.equal(sanitizeOrderRemark('  不要辣\u0007，少放盐  '), '不要辣，少放盐');
  assert.equal(sanitizeOrderRemark('好'.repeat(60)).length, 50);
});

test('sampleData provides 7 dynamic dates, 08:00-22:00 slots, and dish availability across all dates', () => {
  assert.equal(typeof sampleDates, 'function');
  assert.equal(DATES.length, 7);
  const firstDaySlots = SLOTS.filter((slot) => slot.date === DATES[0]);
  assert.equal(firstDaySlots.length, 28);
  assert.equal(firstDaySlots[0]?.start, '08:00');
  assert.equal(firstDaySlots[firstDaySlots.length - 1]?.end, '22:00');

  const chicken = DISHES.find((dish) => dish.dishId === 'demo-dish-chicken');
  assert.ok(chicken);
  for (const date of DATES) {
    const dto = toDishDto(chicken, date);
    assert.equal(dto.onSale, true);
    assert.ok(dto.availableQuantity > 0);
  }
});

test('validateStudentRegisterInput validates 4-32 ASCII account and 8-128 password without trimming password spaces', () => {
  assert.equal(validateStudentRegisterInput('New_Student_01', '  valid-pass-123  '), null);
  assert.match(validateStudentRegisterInput('abc', 'valid-pass-123') ?? '', /4 到 32 位/);
  assert.match(validateStudentRegisterInput('bad name', 'valid-pass-123') ?? '', /4 到 32 位/);
  assert.match(validateStudentRegisterInput('stuKent', 'valid-pass-123') ?? '', /4 到 32 位/);
  assert.match(validateStudentRegisterInput('valid_user', 'short') ?? '', /8 到 128 位/);
  assert.match(validateStudentRegisterInput('valid_user', '        ') ?? '', /全为空格/);
});

test('describeAuthError maps ACCOUNT_TAKEN, RATE_LIMITED, VALIDATION_ERROR and UNAUTHENTICATED clearly', () => {
  assert.match(
    describeAuthError(
      { code: 'ACCOUNT_TAKEN', message: '账号已被使用。', status: 409, retryable: false },
      'register',
    ),
    /账号已被使用/,
  );
  assert.match(
    describeAuthError(
      { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试。', status: 429, retryable: true },
      'register',
    ),
    /频繁/,
  );
  assert.match(
    describeAuthError(
      { code: 'UNAUTHENTICATED', message: '账号或密码不正确。', status: 401, retryable: false },
      'login',
    ),
    /账号或密码不正确/,
  );
});
