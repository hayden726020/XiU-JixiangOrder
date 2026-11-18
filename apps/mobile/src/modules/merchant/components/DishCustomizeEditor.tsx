import { useId, useState, type ReactNode } from 'react';
import type { DishCustomizationDraft } from '../data/types';
import { createCustomizationId } from '../state/dishCustomization';
import { readDishImage } from '../utils/dishImage';
import {
  IconChevronDown,
  IconChevronUp,
  IconImage,
  IconPlus,
  IconSalad,
  IconShoppingBasket,
  IconSlidersHorizontal,
  IconTrash2,
  IconUpload,
} from './MerchantIcons';

interface DishCustomizeEditorProps {
  value: DishCustomizationDraft;
  onChange: (next: DishCustomizationDraft) => void;
  disabled?: boolean;
  mode: 'sample' | 'real';
}

function moveItem<T>(list: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="dish-cx__empty-state">
      <span className="dish-cx__empty-icon">{icon}</span>
      <p>{text}</p>
    </div>
  );
}

export default function DishCustomizeEditor({
  value,
  onChange,
  disabled = false,
  mode,
}: DishCustomizeEditorProps) {
  const imageInputId = useId();
  const [imageError, setImageError] = useState<string | null>(null);
  const [readingImage, setReadingImage] = useState(false);

  function update(next: Partial<DishCustomizationDraft>) {
    onChange({ ...value, ...next });
  }

  function updateGroup(groupId: string, patch: Partial<DishCustomizationDraft['flavorGroups'][number]>) {
    update({
      flavorGroups: value.flavorGroups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    });
  }

  function addGroup(preset?: { name: string; options: string[] }) {
    update({
      flavorGroups: [
        ...value.flavorGroups,
        {
          id: createCustomizationId('flavor'),
          name: preset?.name ?? '',
          required: true,
          options: preset
            ? preset.options.map((name) => ({ id: createCustomizationId('flavor-option'), name }))
            : [],
        },
      ],
    });
  }

  function removeGroup(groupId: string) {
    update({ flavorGroups: value.flavorGroups.filter((group) => group.id !== groupId) });
  }

  function moveGroup(groupId: string, offset: number) {
    const index = value.flavorGroups.findIndex((group) => group.id === groupId);
    update({ flavorGroups: moveItem(value.flavorGroups, index, offset) });
  }

  function addGroupOption(groupId: string) {
    update({
      flavorGroups: value.flavorGroups.map((group) => (group.id === groupId
        ? { ...group, options: [...group.options, { id: createCustomizationId('flavor-option'), name: '' }] }
        : group)),
    });
  }

  function updateGroupOption(groupId: string, optionId: string, name: string) {
    update({
      flavorGroups: value.flavorGroups.map((group) => (group.id === groupId
        ? {
          ...group,
          options: group.options.map((option) => (option.id === optionId ? { ...option, name } : option)),
        }
        : group)),
    });
  }

  function removeGroupOption(groupId: string, optionId: string) {
    update({
      flavorGroups: value.flavorGroups.map((group) => (group.id === groupId
        ? { ...group, options: group.options.filter((option) => option.id !== optionId) }
        : group)),
    });
  }

  function moveGroupOption(groupId: string, optionId: string, offset: number) {
    update({
      flavorGroups: value.flavorGroups.map((group) => {
        if (group.id !== groupId) return group;
        const index = group.options.findIndex((option) => option.id === optionId);
        return { ...group, options: moveItem(group.options, index, offset) };
      }),
    });
  }

  function moveSide(sideId: string, offset: number) {
    const index = value.sides.findIndex((side) => side.id === sideId);
    update({ sides: moveItem(value.sides, index, offset) });
  }

  function moveAddOn(addOnId: string, offset: number) {
    const index = value.addOns.findIndex((addOn) => addOn.id === addOnId);
    update({ addOns: moveItem(value.addOns, index, offset) });
  }

  async function pickImage(file: File | null) {
    if (!file) return;
    setReadingImage(true);
    setImageError(null);
    const result = await readDishImage(file);
    setReadingImage(false);
    if (!result.ok) {
      setImageError(result.error);
      return;
    }
    update({ imageUrl: result.dataUrl });
  }

  const busy = disabled || readingImage;
  const hasSpicyTemplate = value.flavorGroups.some((group) => group.name.trim() === '辣度');

  return (
    <div className="dish-cx">
      <section className="dish-cx__section" data-dish-cx-image>
        <div className="dish-cx__section-head">
          <div className="dish-cx__section-title">
            <span className="dish-cx__section-icon"><IconImage size={17} /></span>
            <div>
              <h4>菜品图片</h4>
              <p className="hint">建议使用正方形图片，学生端按统一比例裁切展示。</p>
            </div>
          </div>
        </div>
        <div className="dish-cx__image-row">
          <div className="dish-cx__image-preview">
            {value.imageUrl ? (
              <img src={value.imageUrl} alt="菜品图片预览" />
            ) : (
              <span className="dish-cx__image-empty">
                <IconImage size={22} />
                <span>暂无图片</span>
              </span>
            )}
          </div>
          <div className="dish-cx__image-actions">
            <label className="dish-cx__file-button" htmlFor={imageInputId}>
              <IconUpload size={15} />
              {readingImage ? '处理中…' : value.imageUrl ? '更换图片' : '选择图片'}
            </label>
            <input
              id={imageInputId}
              className="dish-cx__file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              data-dish-cx-image-input
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                void pickImage(file);
              }}
            />
            <p className="dish-cx__media-meta">支持 JPG、PNG、WebP · 建议 1:1 · 自动压缩至 640px</p>
            {value.imageUrl && (
              <button
                type="button"
                className="dish-cx__text-button"
                onClick={() => update({ imageUrl: null })}
                disabled={busy}
              >
                <IconTrash2 size={13} />
                移除图片
              </button>
            )}
            {mode === 'real' && (
              <p className="hint dish-cx__local-note">保存时上传到服务端，学生端刷新菜单后可见。</p>
            )}
          </div>
        </div>
        {imageError && (
          <p className="action-feedback action-feedback--error" role="alert" data-dish-cx-image-error>
            {imageError}
          </p>
        )}
      </section>

      <section className="dish-cx__section" data-dish-cx-flavor>
        <div className="dish-cx__section-head">
          <div className="dish-cx__section-title">
            <span className="dish-cx__section-icon"><IconSlidersHorizontal size={17} /></span>
            <div>
              <h4>口味特征</h4>
              <p className="hint">学生按组单选，例如辣度、甜度；必选组下单前必须选择。</p>
            </div>
          </div>
          <div className="dish-cx__head-actions">
            <button
              type="button"
              className="dish-cx__add-button"
              onClick={() => addGroup()}
              disabled={busy || value.flavorGroups.length >= 4}
              data-dish-cx-add-group
            >
              <IconPlus size={14} />
              添加特征组
            </button>
            <button
              type="button"
              className="dish-cx__text-button"
              onClick={() => addGroup({ name: '辣度', options: ['不辣', '微辣', '中辣', '特辣'] })}
              disabled={busy || value.flavorGroups.length >= 4 || hasSpicyTemplate}
              title={hasSpicyTemplate ? '已存在「辣度」特征组' : '添加辣度模板'}
              data-dish-cx-template
            >
              使用辣度模板
            </button>
          </div>
        </div>
        {value.flavorGroups.length === 0 ? (
          <EmptyState icon={<IconSlidersHorizontal size={17} />} text="暂未设置口味，添加后学生可选择。" />
        ) : (
          <div className="dish-cx__groups">
            {value.flavorGroups.map((group, groupIndex) => (
              <div className="dish-cx__group" key={group.id} data-dish-cx-group>
                <div className="dish-cx__group-head">
                  <label className="dish-cx__inline-field dish-cx__inline-field--grow">
                    <span>特征组</span>
                    <input
                      value={group.name}
                      maxLength={10}
                      placeholder="例如：辣度"
                      disabled={busy}
                      onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                    />
                  </label>
                  <label className="dish-cx__required">
                    <input
                      type="checkbox"
                      checked={group.required}
                      disabled={busy}
                      onChange={(event) => updateGroup(group.id, { required: event.target.checked })}
                    />
                    必选
                  </label>
                  <span className="dish-cx__rule">单选</span>
                  <span className="dish-cx__row-actions">
                    <button
                      type="button"
                      className="dish-cx__icon-button"
                      onClick={() => moveGroup(group.id, -1)}
                      disabled={busy || groupIndex === 0}
                      aria-label={`上移特征组 ${group.name || '未命名'}`}
                    >
                      <IconChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="dish-cx__icon-button"
                      onClick={() => moveGroup(group.id, 1)}
                      disabled={busy || groupIndex === value.flavorGroups.length - 1}
                      aria-label={`下移特征组 ${group.name || '未命名'}`}
                    >
                      <IconChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="dish-cx__icon-button dish-cx__icon-button--danger"
                      onClick={() => removeGroup(group.id)}
                      disabled={busy}
                      aria-label={`删除特征组 ${group.name || '未命名'}`}
                    >
                      <IconTrash2 size={14} />
                    </button>
                  </span>
                </div>
                <div className="dish-cx__options">
                  {group.options.map((option, optionIndex) => (
                    <span className="dish-cx__option" key={option.id}>
                      <input
                        value={option.name}
                        maxLength={10}
                        placeholder="选项名"
                        disabled={busy}
                        aria-label="口味选项名称"
                        onChange={(event) => updateGroupOption(group.id, option.id, event.target.value)}
                      />
                      <span className="dish-cx__option-actions">
                        <button
                          type="button"
                          className="dish-cx__chip-button"
                          onClick={() => moveGroupOption(group.id, option.id, -1)}
                          disabled={busy || optionIndex === 0}
                          aria-label={`上移选项 ${option.name || '未命名'}`}
                        >
                          <IconChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="dish-cx__chip-button"
                          onClick={() => moveGroupOption(group.id, option.id, 1)}
                          disabled={busy || optionIndex === group.options.length - 1}
                          aria-label={`下移选项 ${option.name || '未命名'}`}
                        >
                          <IconChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="dish-cx__chip-button dish-cx__chip-button--danger"
                          onClick={() => removeGroupOption(group.id, option.id)}
                          disabled={busy}
                          aria-label={`删除选项 ${option.name || '未命名'}`}
                        >
                          <IconTrash2 size={12} />
                        </button>
                      </span>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="dish-cx__option-add"
                    onClick={() => addGroupOption(group.id)}
                    disabled={busy || group.options.length >= 8}
                  >
                    <IconPlus size={12} />
                    选项
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dish-cx__section" data-dish-cx-sides>
        <div className="dish-cx__section-head">
          <div className="dish-cx__section-title">
            <span className="dish-cx__section-icon"><IconSalad size={17} /></span>
            <div>
              <h4>固定配菜</h4>
              <p className="hint">例如土豆丝；学生可选择加或不加，不加价。</p>
            </div>
          </div>
          <div className="dish-cx__head-actions">
            <span className="dish-cx__rule">不加价</span>
            <button
              type="button"
              className="dish-cx__add-button"
              onClick={() => update({ sides: [...value.sides, { id: createCustomizationId('side'), name: '' }] })}
              disabled={busy || value.sides.length >= 10}
              data-dish-cx-add-side
            >
              <IconPlus size={14} />
              添加配菜
            </button>
          </div>
        </div>
        {value.sides.length === 0 ? (
          <EmptyState icon={<IconSalad size={17} />} text="暂未设置固定配菜，学生不会看到配菜选项。" />
        ) : (
          <div className="dish-cx__rows">
            {value.sides.map((side, index) => (
              <div className="dish-cx__row" key={side.id} data-dish-cx-side-row>
                <span className="dish-cx__row-bullet" aria-hidden="true" />
                <label className="dish-cx__inline-field dish-cx__inline-field--grow">
                  <span>配菜</span>
                  <input
                    value={side.name}
                    maxLength={10}
                    placeholder="例如：土豆丝"
                    disabled={busy}
                    aria-label={`固定配菜 ${index + 1}`}
                    onChange={(event) => update({
                      sides: value.sides.map((item) => (item.id === side.id ? { ...item, name: event.target.value } : item)),
                    })}
                  />
                </label>
                <span className="dish-cx__price-static">免费</span>
                <span className="dish-cx__row-actions">
                  <button
                    type="button"
                    className="dish-cx__icon-button"
                    onClick={() => moveSide(side.id, -1)}
                    disabled={busy || index === 0}
                    aria-label={`上移配菜 ${side.name || '未命名'}`}
                  >
                    <IconChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="dish-cx__icon-button"
                    onClick={() => moveSide(side.id, 1)}
                    disabled={busy || index === value.sides.length - 1}
                    aria-label={`下移配菜 ${side.name || '未命名'}`}
                  >
                    <IconChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="dish-cx__icon-button dish-cx__icon-button--danger"
                    onClick={() => update({ sides: value.sides.filter((item) => item.id !== side.id) })}
                    disabled={busy}
                    aria-label={`删除配菜 ${side.name || '未命名'}`}
                  >
                    <IconTrash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dish-cx__section" data-dish-cx-addons>
        <div className="dish-cx__section-head">
          <div className="dish-cx__section-title">
            <span className="dish-cx__section-icon"><IconShoppingBasket size={17} /></span>
            <div>
              <h4>加购项</h4>
              <p className="hint">学生可多选，加价计入合计；0 元为免费加购，不改变分类。</p>
            </div>
          </div>
          <div className="dish-cx__head-actions">
            <span className="dish-cx__rule">计入合计</span>
            <button
              type="button"
              className="dish-cx__add-button"
              onClick={() => update({
                addOns: [...value.addOns, { id: createCustomizationId('addon'), name: '', priceText: '' }],
              })}
              disabled={busy || value.addOns.length >= 10}
              data-dish-cx-add-addon
            >
              <IconPlus size={14} />
              添加加购项
            </button>
          </div>
        </div>
        {value.addOns.length === 0 ? (
          <EmptyState icon={<IconShoppingBasket size={17} />} text="暂未设置加购项，学生不会看到额外加购。" />
        ) : (
          <div className="dish-cx__rows">
            {value.addOns.map((addOn, index) => (
              <div className="dish-cx__row" key={addOn.id} data-dish-cx-addon-row>
                <span className="dish-cx__row-bullet" aria-hidden="true" />
                <label className="dish-cx__inline-field dish-cx__inline-field--grow">
                  <span>加购</span>
                  <input
                    value={addOn.name}
                    maxLength={10}
                    placeholder="例如：卤蛋"
                    disabled={busy}
                    aria-label={`加购项 ${index + 1}`}
                    onChange={(event) => update({
                      addOns: value.addOns.map((item) => (item.id === addOn.id ? { ...item, name: event.target.value } : item)),
                    })}
                  />
                </label>
                <label className="dish-cx__price-field">
                  <span>+ ¥</span>
                  <input
                    value={addOn.priceText}
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={busy}
                    aria-label={`加购项 ${index + 1} 加价（元）`}
                    onChange={(event) => update({
                      addOns: value.addOns.map((item) => (item.id === addOn.id ? { ...item, priceText: event.target.value } : item)),
                    })}
                  />
                </label>
                <span className="dish-cx__row-actions">
                  <button
                    type="button"
                    className="dish-cx__icon-button"
                    onClick={() => moveAddOn(addOn.id, -1)}
                    disabled={busy || index === 0}
                    aria-label={`上移加购项 ${addOn.name || '未命名'}`}
                  >
                    <IconChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="dish-cx__icon-button"
                    onClick={() => moveAddOn(addOn.id, 1)}
                    disabled={busy || index === value.addOns.length - 1}
                    aria-label={`下移加购项 ${addOn.name || '未命名'}`}
                  >
                    <IconChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="dish-cx__icon-button dish-cx__icon-button--danger"
                    onClick={() => update({ addOns: value.addOns.filter((item) => item.id !== addOn.id) })}
                    disabled={busy}
                    aria-label={`删除加购项 ${addOn.name || '未命名'}`}
                  >
                    <IconTrash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}