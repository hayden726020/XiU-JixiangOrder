import type { DishDto, ShopSummary } from '../types';

export function filterDishesByShop(dishes: DishDto[], merchantId: string | null): DishDto[] {
  if (merchantId === null || merchantId === '') {
    return [];
  }
  return dishes.filter((dish) => dish.merchantId === merchantId);
}

export function listShopIdsFromDishes(dishes: DishDto[]): string[] {
  const ids = new Set<string>();
  for (const dish of dishes) {
    if (typeof dish.merchantId === 'string' && dish.merchantId !== '') {
      ids.add(dish.merchantId);
    }
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

/**
 * 真实模式未提供店铺列表时的降级派生：只用菜品归属的 merchantId，
 * 不写入任何店铺名称，页面必须明确标注“店铺名称未提供”。
 */
export function buildMenuDerivedShops(dishes: DishDto[]): ShopSummary[] {
  return listShopIdsFromDishes(dishes).map((merchantId) => ({
    merchantId,
    name: merchantId,
    canteenId: null,
    orderable: null,
    demo: false,
    sortOrder: null,
  }));
}