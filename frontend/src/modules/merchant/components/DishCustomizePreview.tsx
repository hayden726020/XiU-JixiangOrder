import { useState } from 'react';
import type { DishCustomizationDraft } from '../data/types';
import { formatYuan } from '../utils/money';

interface DishCustomizePreviewProps {
  value: DishCustomizationDraft;
  dishName: string;
  unitPriceFen: number;
}

function parsePriceFen(text: string): number {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 0;
  const fen = Math.round(Number(trimmed) * 100);
  return Number.isSafeInteger(fen) && fen >= 0 ? fen : 0;
}

export default function DishCustomizePreview({ value, dishName, unitPriceFen }: DishCustomizePreviewProps) {
  const [flavorChoice, setFlavorChoice] = useState<Record<string, string>>({});
  const [sideChoice, setSideChoice] = useState<Record<string, boolean>>({});
  const [addOnChoice, setAddOnChoice] = useState<Record<string, boolean>>({});

  const totalFen = unitPriceFen + value.addOns.reduce((sum, addOn) => (
    addOnChoice[addOn.id] ? sum + parsePriceFen(addOn.priceText) : sum
  ), 0);

  return (
    <div className="dish-cx-preview" data-dish-cx-preview>
      <div className="dish-cx-preview__head">
        <h4>学生端预览</h4>
        <span className="merchant-readonly-tag">预览 · 不会下单</span>
      </div>
      <div className="dish-cx-preview__card">
        <div className="dish-cx-preview__dish">
          <div className="dish-cx-preview__image">
            {value.imageUrl ? (
              <img src={value.imageUrl} alt="" />
            ) : (
              <span className="dish-cx-preview__image-empty">暂无图片</span>
            )}
          </div>
          <div className="dish-cx-preview__title">
            <strong>{dishName.trim() || '未命名菜品'}</strong>
            <span className="dish-cx-preview__price">{formatYuan(unitPriceFen)}</span>
          </div>
        </div>

        {value.flavorGroups.length === 0 && value.sides.length === 0 && value.addOns.length === 0 && (
          <p className="hint">还没有特征、配菜或加购项。填好后这里会出现按钮。</p>
        )}

        {value.flavorGroups.map((group) => (
          <div className="dish-cx-preview__row" key={group.id}>
            <p className="dish-cx-preview__label">
              {group.name.trim() || '未命名特征'}
              {group.required && <span className="dish-cx-preview__required">必选</span>}
            </p>
            <div className="dish-cx-preview__buttons">
              {group.options.map((option) => {
                const fallback = group.required ? group.options[0]?.id : undefined;
                const active = (flavorChoice[group.id] ?? fallback) === option.id;
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
            <p className="dish-cx-preview__label">固定配菜（不加价）</p>
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
            <p className="dish-cx-preview__label">加购（可多选）</p>
            <div className="dish-cx-preview__buttons">
              {value.addOns.map((addOn) => {
                const selected = addOnChoice[addOn.id] ?? false;
                const priceFen = parsePriceFen(addOn.priceText);
                return (
                  <button
                    type="button"
                    key={addOn.id}
                    className={selected ? 'dish-cx-pill dish-cx-pill--active' : 'dish-cx-pill'}
                    aria-pressed={selected}
                    onClick={() => setAddOnChoice((current) => ({ ...current, [addOn.id]: !selected }))}
                  >
                    {addOn.name.trim() || '未命名加购'}
                    <span className="dish-cx-pill__price">{priceFen > 0 ? ` +${formatYuan(priceFen)}` : ' 免费'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="dish-cx-preview__total">
          <span>学生看到合计</span>
          <strong>{formatYuan(totalFen)}</strong>
        </div>
      </div>
    </div>
  );
}