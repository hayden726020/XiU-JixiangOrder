import type { DishDto } from '../types';
import type { StallPhotoKey } from './shopSelectView';
import stallCounterMianshi from '../assets/stall-counter-mianshi.jpg';
import stallCounterJiachang from '../assets/stall-counter-jiachang.webp';
import stallCounterXiaochao from '../assets/stall-counter-xiaochao.webp';
import dishBeefNoodle from '../assets/dish-beef-noodle.webp';
import dishZhajiangNoodle from '../assets/dish-zhajiang-noodle.jpg';
import dishChickenColdNoodle from '../assets/dish-chicken-cold-noodle.jpg';
import dishTomatoEgg from '../assets/dish-tomato-egg.jpg';
import dishChickenLeg from '../assets/dish-chicken-leg.webp';
import loginFoodRice from '../assets/login-food-rice.jpg';
import loginTrays from '../assets/login-trays.jpg';

export type OrderCategoryId =
  | 'all'
  | 'stir-fry'
  | 'noodles'
  | 'rice-set'
  | 'mala'
  | 'fast-food'
  | 'light-meal'
  | 'drinks';

export const STALL_PHOTOS: Record<StallPhotoKey, string> = {
  mianshi: stallCounterMianshi,
  dazhong: stallCounterJiachang,
  fengwei: stallCounterXiaochao,
};

const FALLBACK_DISH_PHOTOS = [
  dishBeefNoodle,
  dishTomatoEgg,
  loginFoodRice,
  dishChickenLeg,
];

/**
 * Matches a dish name to a clean food photograph, falling back deterministically by index.
 */
export function resolveDishPhoto(name: string, index: number): string {
  if (/牛肉面|拉面|汤面/.test(name)) return dishBeefNoodle;
  if (/炸酱|拌面/.test(name)) return dishZhajiangNoodle;
  if (/凉面|鸡丝/.test(name)) return dishChickenColdNoodle;
  if (/黑椒|鸡腿/.test(name)) return dishChickenLeg;
  if (/演示番茄炒蛋|青椒|肉丝|小炒|热菜/.test(name)) return loginTrays;
  if (/番茄炒蛋/.test(name)) return dishTomatoEgg;
  if (/鸡肉饭|盖饭|套餐|米饭/.test(name)) return loginFoodRice;
  return FALLBACK_DISH_PHOTOS[index % FALLBACK_DISH_PHOTOS.length];
}

/**
 * Orders dishes for the stall preview row so staple mains appear before side soups.
 */
export function pickPreviewDishes(dishes: DishDto[]): DishDto[] {
  const score = (dish: DishDto): number => {
    if (/汤|蛋花|卤蛋/.test(dish.name)) return 2;
    if (/牛肉面|炸酱|凉面|番茄炒蛋饭|黑椒鸡腿饭/.test(dish.name)) return 0;
    return 1;
  };
  return dishes
    .slice()
    .sort((left, right) => score(left) - score(right))
    .slice(0, 3);
}

/**
 * Checks whether a stall and its dishes belong to the selected category.
 */
export function matchesOrderCategory(
  category: OrderCategoryId,
  stallTitle: string,
  dishNames: string[],
): boolean {
  if (category === 'all') return true;
  const combined = `${stallTitle} ${dishNames.join(' ')}`;
  switch (category) {
    case 'stir-fry':
      return /家常|小炒|炒|大众|番茄|肉丝/.test(combined);
    case 'noodles':
      return /面|粉|饺|拉面|拌面|凉面/.test(combined);
    case 'rice-set':
      return /饭|套餐|盖饭|鸡腿|鸡肉|家常/.test(combined);
    case 'mala':
      return /麻辣|香锅|川|辣/.test(combined);
    case 'fast-food':
      return /快餐|小吃|炸|汉堡|卤蛋/.test(combined);
    case 'light-meal':
      return /轻食|简餐|沙拉|凉面|减脂/.test(combined);
    case 'drinks':
      return /饮品|甜点|奶茶|果汁|汤|豆浆/.test(combined);
    default:
      return true;
  }
}
