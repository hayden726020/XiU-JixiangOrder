import { useId, useState } from 'react';
import type { DishCustomizationDraft } from '../data/types';
import { createCustomizationId } from '../state/dishCustomization';
import { readDishImage } from '../utils/dishImage';

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

function EmptyImage() {
  return (
    <span className="dish-cx__image-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="9" cy="9.5" r="1.6" />
        <path d="M3 17l5-5 4 4 3-3 6 6" />
      </svg>
      <span>暂无图片</span>
    </span>
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

  return (
    <div className="dish-cx">
      <section className="dish-cx__section" data-dish-cx-image>
        <div className="dish-cx__head">
          <div>
            <h4>菜品图片</h4>
            <p className="hint">商家自己选图，学生端会按固定比例展示；支持 JPG、PNG、WebP，自动压缩到 640px。</p>
          </div>
        </div>
        <div className="dish-cx__image-row">
          <div className="dish-cx__image-preview">
            {value.imageUrl ? (
              <img src={value.imageUrl} alt="菜品图片预览" />
            ) : (
              <EmptyImage />
            )}
          </div>
          <div className="dish-cx__image-actions">
            <label className="dish-cx__file-button" htmlFor={imageInputId}>
              {readingImage ? '处理中…' : value.imageUrl ? '更换图片' : '选择图片'}
            </label>
            <input
              id={imageInputId}
              className="dish-cx__file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                void pickImage(file);
              }}
            />
            {value.imageUrl && (
              <button
                type="button"
                className="dish-cx__ghost-button"
                onClick={() => update({ imageUrl: null })}
                disabled={busy}
              >
                移除图片
              </button>
            )}
            {mode === 'real' && (
              <p className="hint dish-cx__local-note">
                当前图片先保存在本机，服务端图片字段完成后才会同步到学生端。
              </p>
            )}
          </div>
        </div>
        {imageError && <p className="action-feedback action-feedback--error" role="alert">{imageError}</p>}
      </section>

      <section className="dish-cx__section" data-dish-cx-flavor>
        <div className="dish-cx__head">
          <div>
            <h4>口味特征</h4>
            <p className="hint">例如「辣度」下放微辣、中辣、特辣；学生从每组单选一个。</p>
          </div>
          <div className="dish-cx__head-actions">
            <button
              type="button"
              className="dish-cx__add-button"
              onClick={() => addGroup()}
              disabled={busy || value.flavorGroups.length >= 4}
              data-dish-cx-add-group
            >
              + 添加特征组
            </button>
            <button
              type="button"
              className="dish-cx__ghost-button"
              onClick={() => addGroup({ name: '辣度', options: ['不辣', '微辣', '中辣', '特辣'] })}
              disabled={busy || value.flavorGroups.length >= 4}
            >
              用辣度模板
            </button>
          </div>
        </div>
        {value.flavorGroups.length === 0 ? (
          <p className="dish-cx__empty">还没有口味特征。可不填，需要时点「添加特征组」。</p>
        ) : (
          <div className="dish-cx__groups">
            {value.flavorGroups.map((group, groupIndex) => (
              <div className="dish-cx__group" key={group.id}>
                <div className="dish-cx__group-head">
                  <label className="dish-cx__field dish-cx__field--grow">
                    特征组名称
                    <input
                      value={group.name}
                      maxLength={10}
                      placeholder="例如：辣度"
                      disabled={busy}
                      onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                    />
                  </label>
                  <label className="dish-cx__check">
                    <input
                      type="checkbox"
                      checked={group.required}
                      disabled={busy}
                      onChange={(event) => updateGroup(group.id, { required: event.target.checked })}
                    />
                    学生必须选
                  </label>
                  <span className="dish-cx__order">
                    <button
                      type="button"
                      className="dish-cx__order-button"
                      onClick={() => moveGroup(group.id, -1)}
                      disabled={busy || groupIndex === 0}
                      aria-label={`上移特征组 ${group.name || '未命名'}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="dish-cx__order-button"
                      onClick={() => moveGroup(group.id, 1)}
                      disabled={busy || groupIndex === value.flavorGroups.length - 1}
                      aria-label={`下移特征组 ${group.name || '未命名'}`}
                    >
                      ↓
                    </button>
                  </span>
                  <button
                    type="button"
                    className="dish-cx__remove-button"
                    onClick={() => removeGroup(group.id)}
                    disabled={busy}
                    aria-label={`删除特征组 ${group.name || '未命名'}`}
                  >
                    删除组
                  </button>
                </div>
                <div className="dish-cx__chips">
                  {group.options.map((option, optionIndex) => (
                    <span className="dish-cx__chip-edit" key={option.id}>
                      <input
                        value={option.name}
                        maxLength={10}
                        placeholder="选项名"
                        disabled={busy}
                        aria-label="特征选项名称"
                        onChange={(event) => updateGroupOption(group.id, option.id, event.target.value)}
                      />
                      <span className="dish-cx__chip-order">
                        <button
                          type="button"
                          className="dish-cx__chip-move"
                          onClick={() => moveGroupOption(group.id, option.id, -1)}
                          disabled={busy || optionIndex === 0}
                          aria-label={`上移选项 ${option.name || '未命名'}`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="dish-cx__chip-move"
                          onClick={() => moveGroupOption(group.id, option.id, 1)}
                          disabled={busy || optionIndex === group.options.length - 1}
                          aria-label={`下移选项 ${option.name || '未命名'}`}
                        >
                          ↓
                        </button>
                      </span>
                      <button
                        type="button"
                        className="dish-cx__chip-remove"
                        onClick={() => removeGroupOption(group.id, option.id)}
                        disabled={busy}
                        aria-label={`删除选项 ${option.name || '未命名'}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="dish-cx__chip-add"
                    onClick={() => addGroupOption(group.id)}
                    disabled={busy || group.options.length >= 8}
                  >
                    + 选项
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dish-cx__section" data-dish-cx-sides>
        <div className="dish-cx__head">
          <div>
            <h4>固定配菜</h4>
            <p className="hint">例如每道菜都配土豆丝；学生可以选「加」或「不加」，不加价。</p>
          </div>
          <button
            type="button"
            className="dish-cx__add-button"
            onClick={() => update({ sides: [...value.sides, { id: createCustomizationId('side'), name: '' }] })}
            disabled={busy || value.sides.length >= 10}
            data-dish-cx-add-side
          >
            + 添加配菜
          </button>
        </div>
        {value.sides.length === 0 ? (
          <p className="dish-cx__empty">还没有固定配菜，学生不会看到配菜选项。</p>
        ) : (
          <div className="dish-cx__rows">
            {value.sides.map((side, index) => (
              <div className="dish-cx__row" key={side.id}>
                <label className="dish-cx__field dish-cx__field--grow">
                  配菜名称
                  <input
                    value={side.name}
                    maxLength={10}
                    placeholder="例如：土豆丝"
                    disabled={busy}
                    onChange={(event) => update({
                      sides: value.sides.map((item) => (item.id === side.id ? { ...item, name: event.target.value } : item)),
                    })}
                  />
                </label>
                <span className="dish-cx__price-static">免费</span>
                <span className="dish-cx__order">
                  <button
                    type="button"
                    className="dish-cx__order-button"
                    onClick={() => moveSide(side.id, -1)}
                    disabled={busy || index === 0}
                    aria-label={`上移配菜 ${side.name || '未命名'}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="dish-cx__order-button"
                    onClick={() => moveSide(side.id, 1)}
                    disabled={busy || index === value.sides.length - 1}
                    aria-label={`下移配菜 ${side.name || '未命名'}`}
                  >
                    ↓
                  </button>
                </span>
                <button
                  type="button"
                  className="dish-cx__remove-button"
                  onClick={() => update({ sides: value.sides.filter((item) => item.id !== side.id) })}
                  disabled={busy}
                  aria-label={`删除配菜 ${side.name || '未命名'}`}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dish-cx__section" data-dish-cx-addons>
        <div className="dish-cx__head">
          <div>
            <h4>加购项</h4>
            <p className="hint">例如卤蛋、饮料、加饭；学生可多选，加价计入合计，定价 0 元为免费加购。</p>
          </div>
          <button
            type="button"
            className="dish-cx__add-button"
            onClick={() => update({
              addOns: [...value.addOns, { id: createCustomizationId('addon'), name: '', priceText: '' }],
            })}
            disabled={busy || value.addOns.length >= 10}
            data-dish-cx-add-addon
          >
            + 添加加购项
          </button>
        </div>
        {value.addOns.length === 0 ? (
          <p className="dish-cx__empty">还没有加购项，学生不会看到额外加购。</p>
        ) : (
          <div className="dish-cx__rows">
            {value.addOns.map((addOn, index) => (
              <div className="dish-cx__row" key={addOn.id}>
                <label className="dish-cx__field dish-cx__field--grow">
                  加购名称
                  <input
                    value={addOn.name}
                    maxLength={10}
                    placeholder="例如：卤蛋"
                    disabled={busy}
                    onChange={(event) => update({
                      addOns: value.addOns.map((item) => (item.id === addOn.id ? { ...item, name: event.target.value } : item)),
                    })}
                  />
                </label>
                <label className="dish-cx__field">
                  加价（元）
                  <input
                    value={addOn.priceText}
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={busy}
                    onChange={(event) => update({
                      addOns: value.addOns.map((item) => (item.id === addOn.id ? { ...item, priceText: event.target.value } : item)),
                    })}
                  />
                </label>
                <span className="dish-cx__order">
                  <button
                    type="button"
                    className="dish-cx__order-button"
                    onClick={() => moveAddOn(addOn.id, -1)}
                    disabled={busy || index === 0}
                    aria-label={`上移加购项 ${addOn.name || '未命名'}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="dish-cx__order-button"
                    onClick={() => moveAddOn(addOn.id, 1)}
                    disabled={busy || index === value.addOns.length - 1}
                    aria-label={`下移加购项 ${addOn.name || '未命名'}`}
                  >
                    ↓
                  </button>
                </span>
                <button
                  type="button"
                  className="dish-cx__remove-button"
                  onClick={() => update({ addOns: value.addOns.filter((item) => item.id !== addOn.id) })}
                  disabled={busy}
                  aria-label={`删除加购项 ${addOn.name || '未命名'}`}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}