import { useState } from 'react';
import type {
  DishDto,
  ItemCustomizationSelection,
  SelectedFlavor,
} from '../types';
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

function emptySelection(): ItemCustomizationSelection {
  return { selectedFlavors: [], selectedSides: [], selectedAddOns: [] };
}

function summaryOf(dish: DishDto, selection: ItemCustomizationSelection): string {
  const names: string[] = [];
  for (const entry of selection.selectedFlavors) {
    const group = dish.flavorGroups.find((item) => item.id === entry.groupId);
    const option = group?.options.find((item) => item.id === entry.optionId);
    if (option) names.push(`${group?.name ?? ''}：${option.name}`);
  }
  for (const id of selection.selectedSides) {
    const side = dish.sides.find((item) => item.id === id);
    if (side) names.push(side.name);
  }
  for (const id of selection.selectedAddOns) {
    const addOn = dish.addOns.find((item) => item.id === id);
    if (addOn) names.push(`${addOn.name} +${formatYuan(addOn.priceFen)}`);
  }
  return names.join('、');
}

function missingRequiredGroup(dish: DishDto, selection: ItemCustomizationSelection): string | null {
  const chosen = new Set(selection.selectedFlavors.map((entry) => entry.groupId));
  const missing = dish.flavorGroups.find((group) => group.required && !chosen.has(group.id));
  return missing ? missing.name : null;
}

export default function OrderDishCard({ dish, quantity, index, customization, onQuantityChange, onCustomizationChange }: {
  dish: DishDto;
  quantity: number;
  index: number;
  customization: ItemCustomizationSelection | null;
  onQuantityChange: (next: number) => void;
  onCustomizationChange: (selection: ItemCustomizationSelection) => { ok: boolean; message: string | null };
}) {
  const view = toDishView(dish);
  const limit = dish.onSale ? Math.max(0, dish.availableQuantity) : 0;
  const atLimit = view.kind === 'ON_SALE' && quantity >= limit;
  const visual = visualForDish(dish.name);
  const photo = dish.imageUrl ?? visual.photo;
  const hasOptions = dish.flavorGroups.length > 0 || dish.sides.length > 0 || dish.addOns.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [hint, setHint] = useState('');
  const [draft, setDraft] = useState<ItemCustomizationSelection>(() => customization ?? emptySelection());
  const summary = summaryOf(dish, customization ?? emptySelection());

  function openPanel(): void {
    setDraft(customization ?? emptySelection());
    setHint('');
    setExpanded((value) => !value);
  }

  function chooseFlavor(groupId: string, optionId: string): void {
    setDraft((value) => {
      const others = value.selectedFlavors.filter((entry) => entry.groupId !== groupId);
      const already = value.selectedFlavors.find(
        (entry) => entry.groupId === groupId && entry.optionId === optionId,
      );
      const next: SelectedFlavor[] = already
        ? others
        : [...others, { groupId, optionId }];
      return { ...value, selectedFlavors: next };
    });
  }

  function toggleId(field: 'selectedSides' | 'selectedAddOns', id: string): void {
    setDraft((value) => {
      const list = value[field];
      return {
        ...value,
        [field]: list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id],
      };
    });
  }

  function confirmSelection(): void {
    const missing = missingRequiredGroup(dish, draft);
    if (missing) {
      setHint(`请选择必选口味「${missing}」`);
      return;
    }
    const result = onCustomizationChange(draft);
    if (!result.ok) {
      setHint(result.message ?? '配菜选择未保存，请重试。');
      return;
    }
    setHint('');
    setExpanded(false);
  }

  function increase(): void {
    if (hasOptions) {
      const missing = missingRequiredGroup(dish, customization ?? emptySelection());
      if (missing) {
        setDraft(customization ?? emptySelection());
        setExpanded(true);
        setHint(`请选择必选口味「${missing}」`);
        return;
      }
    }
    onQuantityChange(quantity + 1);
  }

  return <li className={`meal-dish${view.kind === 'OFF_SALE' ? ' is-off' : ''}`} data-dish-id={dish.dishId}>
    <span className="meal-dish__tape" aria-hidden="true" />
    <div className="meal-dish__photo"><img src={photo} alt="" loading={index > 2 ? 'lazy' : 'eager'} /></div>
    <div className="meal-dish__details">
      <div className="meal-dish__ornament"><OrderMenuIcon name={visual.ornament} size={44} /></div>
      <h3>{dish.name}</h3>
      <p className="meal-dish__ingredients">菜品图片仅供参考</p>
      <span className={`meal-dish__stock${view.kind === 'SHORTAGE' ? ' is-shortage' : ''}`}>{view.metaText}</span>
      {atLimit ? <small className="meal-dish__limit">{DISH_LIMIT_TEXT}</small> : null}
      {hasOptions ? <button
        type="button"
        className={`meal-dish__customize${summary ? ' has-value' : ''}`}
        aria-expanded={expanded}
        onClick={openPanel}
        data-action="customize-dish"
      >{summary ? `已选：${summary}` : '选配菜/口味'} <OrderMenuIcon name="chevron" size={14} /></button> : null}
      {expanded ? <div className="meal-dish__cx" role="group" aria-label={`${dish.name} 配菜与口味`}>
        {dish.flavorGroups.map((group) => <section key={group.id} className="meal-dish__cx-group">
          <p className="meal-dish__cx-label">{group.name}{group.required ? <em>必选</em> : <small>可选</small>}</p>
          <div className="meal-dish__cx-options">
            {group.options.map((option) => {
              const active = draft.selectedFlavors.some(
                (entry) => entry.groupId === group.id && entry.optionId === option.id,
              );
              return <button
                key={option.id}
                type="button"
                className={active ? 'is-active' : ''}
                aria-pressed={active}
                onClick={() => chooseFlavor(group.id, option.id)}
              >{option.name}</button>;
            })}
          </div>
        </section>)}
        {dish.sides.length > 0 ? <section className="meal-dish__cx-group">
          <p className="meal-dish__cx-label">配菜<small>可多选</small></p>
          <div className="meal-dish__cx-options">
            {dish.sides.map((side) => {
              const active = draft.selectedSides.includes(side.id);
              return <button
                key={side.id}
                type="button"
                className={active ? 'is-active' : ''}
                aria-pressed={active}
                onClick={() => toggleId('selectedSides', side.id)}
              >{side.name}</button>;
            })}
          </div>
        </section> : null}
        {dish.addOns.length > 0 ? <section className="meal-dish__cx-group">
          <p className="meal-dish__cx-label">加购<small>可多选</small></p>
          <div className="meal-dish__cx-options">
            {dish.addOns.map((addOn) => {
              const active = draft.selectedAddOns.includes(addOn.id);
              return <button
                key={addOn.id}
                type="button"
                className={active ? 'is-active' : ''}
                aria-pressed={active}
                onClick={() => toggleId('selectedAddOns', addOn.id)}
              >{addOn.name} <b>+{formatYuan(addOn.priceFen)}</b></button>;
            })}
          </div>
        </section> : null}
        {hint ? <p className="meal-dish__cx-hint" role="alert">{hint}</p> : null}
        <div className="meal-dish__cx-actions">
          <button type="button" onClick={() => { setExpanded(false); setHint(''); }}>取消</button>
          <button type="button" className="is-primary" onClick={confirmSelection}>{quantity > 0 ? '更新选择' : '加入并选 1 份'}</button>
        </div>
      </div> : null}
      <div className="meal-dish__bottom">
        <strong className="meal-dish__price">{formatYuan(dish.unitPriceFen)}</strong>
        {view.stepperVisible ? <div className="meal-dish__stepper" role="group" aria-label={`${dish.name} 数量`}>
          <button type="button" aria-label={`减少 ${dish.name}`} disabled={quantity <= 0} onClick={() => onQuantityChange(quantity - 1)}>−</button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" aria-label={`增加 ${dish.name}`} disabled={atLimit} onClick={increase}>+</button>
        </div> : null}
      </div>
    </div>
  </li>;
}