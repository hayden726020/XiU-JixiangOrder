import type { DishDto } from '../types';
import { toDishView } from '../utils/dishView';
import { formatYuan } from '../utils/money';
import { DISH_LIMIT_TEXT } from '../utils/submitTexts';
import OrderMenuIcon from './OrderMenuIcons';
import chickenPhoto from '../assets/dish-chicken-rice.png';
import mealPhoto from '../assets/login-trays.jpg';
import beefPhoto from '../assets/login-food-rice.jpg';

function visualForDish(name: string) {
  if (/鸡/.test(name)) return { photo: chickenPhoto, ornament: 'bowl' as const };
  if (/牛|辣/.test(name)) return { photo: beefPhoto, ornament: 'pepper' as const };
  return { photo: mealPhoto, ornament: 'cloche' as const };
}

export default function OrderDishCard({ dish, quantity, index, onQuantityChange }: {
  dish: DishDto;
  quantity: number;
  index: number;
  onQuantityChange: (next: number) => void;
}) {
  const view = toDishView(dish);
  const limit = dish.onSale ? Math.max(0, dish.availableQuantity) : 0;
  const atLimit = view.kind === 'ON_SALE' && quantity >= limit;
  const visual = visualForDish(dish.name);
  const photo = dish.imageUrl ?? visual.photo;
  return <li className={`meal-dish${view.kind === 'OFF_SALE' ? ' is-off' : ''}`} data-dish-id={dish.dishId}>
    <span className="meal-dish__tape" aria-hidden="true" />
    <div className="meal-dish__photo"><img src={photo} alt="" loading={index > 2 ? 'lazy' : 'eager'} /></div>
    <div className="meal-dish__details">
      <div className="meal-dish__ornament"><OrderMenuIcon name={visual.ornament} size={44} /></div>
      <h3>{dish.name}</h3>
      <p className="meal-dish__ingredients">菜品图片仅供参考</p>
      <span className={`meal-dish__stock${view.kind === 'SHORTAGE' ? ' is-shortage' : ''}`}>{view.metaText}</span>
      {atLimit ? <small className="meal-dish__limit">{DISH_LIMIT_TEXT}</small> : null}
      <div className="meal-dish__bottom">
        <strong className="meal-dish__price">{formatYuan(dish.unitPriceFen)}</strong>
        {view.stepperVisible ? <div className="meal-dish__stepper" role="group" aria-label={`${dish.name} 数量`}>
          <button type="button" aria-label={`减少 ${dish.name}`} disabled={quantity <= 0} onClick={() => onQuantityChange(quantity - 1)}>−</button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" aria-label={`增加 ${dish.name}`} disabled={atLimit} onClick={() => onQuantityChange(quantity + 1)}>+</button>
        </div> : null}
      </div>
    </div>
  </li>;
}
