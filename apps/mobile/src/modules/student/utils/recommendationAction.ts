import type { OrderDraft } from '../state/orderDraft';
import type { DishDto } from '../types';

export function canAddRecommendedDish(draft: OrderDraft, dish: DishDto | undefined, date: string): boolean {
  if (!dish || !dish.onSale || dish.availableQuantity <= 0) return false;
  const selected = draft.getState().items.find((item) => item.dishId === dish.dishId)?.quantity ?? 0;
  return selected < dish.availableQuantity
    && draft.canSetShop()
    && draft.getState().status === 'idle'
    && draft.getState().date === date
    && draft.getShopId() === dish.merchantId;
}

export function addRecommendedDish(
  draft: OrderDraft,
  dish: DishDto,
  date: string,
  enterShop: () => void,
): boolean {
  if (!canAddRecommendedDish(draft, dish, date)) {
    enterShop();
    return false;
  }
  enterShop();
  if (draft.getShopId() !== dish.merchantId || draft.getState().date !== date) return false;
  const quantity = draft.getState().items.find((item) => item.dishId === dish.dishId)?.quantity ?? 0;
  draft.setQuantity(dish, quantity + 1);
  return true;
}
