import { useState } from 'react';
import type { DishCustomizationDraft } from '../data/types';
import { parsePriceTextToFen } from '../state/dishCustomization';
import { formatYuan } from '../utils/money';
import { IconImage, IconSmartphone } from './MerchantIcons';

interface DishCustomizePreviewProps {
  value: DishCustomizationDraft;
  dishName: string;
  unitPriceFen: number;
  priceText?: string;
}

export default function DishCustomizePreview({
  value,
  dishName,
  unitPriceFen,
  priceText,
}: DishCustomizePreviewProps) {
  const [flavorChoice, setFlavorChoice] = useState<Record<string, string>>({});
  const [sideChoice, setSideChoice] = useState<Record<string, boolean>>({});
  const [addOnChoice, setAddOnChoice] = useState<Record<string, boolean>>({});

  const priceValid = priceText === undefined
    || (/^\d+(\.\d{1,2})?$/.test(priceText.trim()) && Number.isSafeInteger(unitPriceFen) && unitPriceFen > 0);
  const extraFen = value.addOns.reduce((sum, addOn) => {
    if (!addOnChoice[addOn.id]) return sum;
    return sum + (parsePriceTextToFen(addOn.priceText) ?? 0);
  }, 0);
  const totalFen = unitPriceFen + extraFen;
  const hasOptions = value.flavorGroups.length > 0 || value.sides.length > 0 || value.addOns.length > 0;

  return (
    <section className="dish-cx-preview" data-dish-cx-preview aria-label="学生端实时预览">
      <div className="dish-cx-preview__head">
        <h4><IconSmartphone size={16} />学生端预览</h4>
        <span className="dish-cx-preview__tag">本地预览 · 不下单</span>
      </div>
      <div className="dish-cx-preview__card">
        <div className="dish-cx-preview__dish">
          <div className="dish-cx-preview__image">
            {value.imageUrl ? (
              <img src={value.imageUrl} alt="" />
            ) : (
              <span className="dish-cx-preview__image-empty">
                <IconImage size={20} />
                <span>暂无图片</span>
              </span>
            )}
          </div>
          <div className="dish-cx-preview__title">
            <span className="dish-cx-preview__eyebrow">菜品预览</span>
            <strong>{dishName.trim() || '未命名菜品'}</strong>
            <span className="dish-cx-preview__price">
              {priceValid ? formatYuan(unitPriceFen) : '¥--'}
            </span>
          </div>
        </div>

        {value.flavorGroups.map((group) => (
          <div className="dish-cx-preview__row" key={group.id}>
            <p className="dish-cx-preview__label">
              {group.name.trim() || '未命名特征'}
              {group.required && <span className="dish-cx-preview__required">必选</span>}
            </p>
            <div className="dish-cx-preview__buttons">
              {group.options.map((option) => {
                const active = flavorChoice[group.id] === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={active ? 'dish-cx-pill dish-cx-pill--active' : 'dish-cx-pill'}
                    aria-pressed={active}
                    onClick={() => setFlavorChoice((current) => ({ ...current, [group.id]: option.id }))}
                  >
                    {option.name.trim() || '未命名'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {value.sides.length > 0 && (
          <div className="dish-cx-preview__row">
            <p className="dish-cx-preview__label">固定配菜 <span className="dish-cx-preview__hint">不加价</span></p>
            <div className="dish-cx-preview__sides">
              {value.sides.map((side) => {
                const included = sideChoice[side.id] ?? false;
                return (
                  <div className="dish-cx-preview__side" key={side.id}>
                    <span>{side.name.trim() || '未命名配菜'}</span>
                    <div className="dish-cx-preview__buttons">
                      <button
                        type="button"
                        className={included ? 'dish-cx-pill dish-cx-pill--active' : 'dish-cx-pill'}
                        aria-pressed={included}
                        onClick={() => setSideChoice((current) => ({ ...current, [side.id]: true }))}
                      >
                        加
                      </button>
                      <button
                        type="button"
                        className={included ? 'dish-cx-pill' : 'dish-cx-pill dish-cx-pill--active'}
                        aria-pressed={!included}
                        onClick={() => setSideChoice((current) => ({ ...current, [side.id]: false }))}
                      >
                        不加
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {value.addOns.length > 0 && (
          <div className="dish-cx-preview__row">
            <p className="dish-cx-preview__label">加购 <span className="dish-cx-preview__hint">可多选</span></p>
            <div className="dish-cx-preview__buttons">
              {value.addOns.map((addOn) => {
                const selected = addOnChoice[addOn.id] ?? false;
                const priceFen = parsePriceTextToFen(addOn.priceText);
                const priceLabel = priceFen === null
                  ? '价格待填写'
                  : priceFen > 0 ? `+${formatYuan(priceFen)}` : '免费';
                return (
                  <button
                    type="button"
                    key={addOn.id}
                    className={selected ? 'dish-cx-pill dish-cx-pill--active' : 'dish-cx-pill'}
                    aria-pressed={selected}
                    onClick={() => setAddOnChoice((current) => ({ ...current, [addOn.id]: !selected }))}
                  >
                    {addOn.name.trim() || '未命名加购'}
                    <span className="dish-cx-pill__price">{priceLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!hasOptions && (
          <p className="dish-cx-preview__empty">暂未配置口味、配菜或加购项</p>
        )}

        <div className="dish-cx-preview__summary">
          <span>基础价格 <b>{priceValid ? formatYuan(unitPriceFen) : '待填写'}</b></span>
          {extraFen > 0 && <span>加购 <b>+{formatYuan(extraFen)}</b></span>}
        </div>
        <div className="dish-cx-preview__total">
          <span>学生看到合计</span>
          <strong data-dish-cx-preview-total>{priceValid ? formatYuan(totalFen) : '¥--'}</strong>
        </div>
        <p className="dish-cx-preview__note">只用于本地预览，不创建订单、不扣库存。</p>
      </div>
    </section>
  );
}