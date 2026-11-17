import assert from 'node:assert/strict';
import { it } from 'node:test';
import { addRecommendedDish, canAddRecommendedDish } from '../src/modules/student/utils/recommendationAction.ts';

const dish = {
  dishId: 'dish-1',
  merchantId: 'shop-1',
  name: '鸡肉饭',
  unitPriceFen: 1800,
  availableQuantity: 5,
  onSale: true,
};

function makeDraft() {
  const state = { status: 'idle', date: '2026-11-17', items: [] };
  let shopId = 'shop-1';
  const quantities = [];
  return {
    state,
    quantities,
    getState: () => state,
    getShopId: () => shopId,
    setShopId: (next) => { shopId = next; },
    canSetShop: () => true,
    setQuantity: (_dish, quantity) => { quantities.push(quantity); },
  };
}

it('adds one recommended dish to the current shop and date', () => {
  const draft = makeDraft();
  draft.state.items = [{ dishId: dish.dishId, quantity: 1 }];
  assert.equal(canAddRecommendedDish(draft, dish, '2026-11-17'), true);
  assert.equal(addRecommendedDish(draft, dish, '2026-11-17', () => {}), true);
  assert.deepEqual(draft.quantities, [2]);
});

it('does not add a today dish after entering a shop restores a tomorrow draft', () => {
  const draft = makeDraft();
  assert.equal(addRecommendedDish(draft, dish, '2026-11-17', () => {
    draft.state.date = '2026-11-18';
  }), false);
  assert.deepEqual(draft.quantities, []);
});

it('does not offer direct add for a different shop or a pending submission', () => {
  const draft = makeDraft();
  draft.setShopId('shop-2');
  assert.equal(canAddRecommendedDish(draft, dish, '2026-11-17'), false);
  let entered = 0;
  assert.equal(addRecommendedDish(draft, dish, '2026-11-17', () => { entered += 1; }), false);
  assert.equal(entered, 1);
  assert.deepEqual(draft.quantities, []);
  draft.setShopId('shop-1');
  draft.state.status = 'submitting';
  assert.equal(canAddRecommendedDish(draft, dish, '2026-11-17'), false);
});

it('does not promise an add when the recommended dish is already at its limit', () => {
  const draft = makeDraft();
  draft.state.items = [{ dishId: dish.dishId, quantity: dish.availableQuantity }];
  assert.equal(canAddRecommendedDish(draft, dish, '2026-11-17'), false);
  let entered = 0;
  assert.equal(addRecommendedDish(draft, dish, '2026-11-17', () => { entered += 1; }), false);
  assert.equal(entered, 1);
  assert.deepEqual(draft.quantities, []);
});
