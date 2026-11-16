import { useEffect, useState, type FormEvent } from 'react';
import { createRequestId } from '../../../shared/requestId';
import type { Session } from '../../../shared/session';
import type { MerchantSource } from '../data/types';
import {
  DISH_TYPE_OPTIONS,
  canUseOnboarding,
  validateMerchantRegistration,
  validateNewDish,
  validateShop,
  type DishType,
  type MerchantRegistrationDraft,
  type NewDishDraft,
  type NewDishValue,
  type OnboardingErrors,
  type OnboardingField,
  type ShopDraft,
} from '../state/onboarding';

type Step = 1 | 2 | 3;

interface OnboardingPageProps {
  mode: 'sample' | 'real';
  session: Session | null;
  source: MerchantSource;
  onDataChanged?: () => void;
  onBack: () => void;
}

const EMPTY_MERCHANT: MerchantRegistrationDraft = {
  merchantName: '',
  contactName: '',
  contactPhone: '',
};

const EMPTY_SHOP: ShopDraft = {
  shopName: '',
  location: '',
  description: '',
};

const EMPTY_DISH: NewDishDraft = {
  type: '',
  name: '',
  priceText: '',
  quantityText: '',
};

const STEPS: ReadonlyArray<{ id: Step; label: string }> = [
  { id: 1, label: '商家注册' },
  { id: 2, label: '创建店铺' },
  { id: 3, label: '新增菜品' },
];

export default function OnboardingPage({
  mode,
  session,
  source,
  onDataChanged,
  onBack,
}: OnboardingPageProps) {
  const [step, setStep] = useState<Step>(1);
  const [merchant, setMerchant] = useState<MerchantRegistrationDraft>(EMPTY_MERCHANT);
  const [shop, setShop] = useState<ShopDraft>(EMPTY_SHOP);
  const [dish, setDish] = useState<NewDishDraft>(EMPTY_DISH);
  const [dishPreview, setDishPreview] = useState<NewDishValue | null>(null);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [profileHint, setProfileHint] = useState<string | null>(null);
  const [saving, setSaving] = useState<'merchant' | 'shop' | 'dish' | null>(null);
  const [completed, setCompleted] = useState({ merchant: false, shop: false, dish: false });

  const allowed = mode === 'sample'
    || canUseOnboarding(
      session?.user.role ?? null,
      session?.user.merchantId,
      session?.expiresAt ?? null,
    );

  function info(text: string) {
    setFeedback(text);
    setFeedbackError(false);
  }

  function error(text: string) {
    setFeedback(text);
    setFeedbackError(true);
  }

  function clearFeedback() {
    setFeedback(null);
    setFeedbackError(false);
  }

  function onboardingErrorText(failure: { code: string; message: string }, action: string): string {
    if (failure.code === 'ONBOARDING_API_MISSING') {
      return `${failure.message} 这不是成功，页面未保存。`;
    }
    if (failure.code === 'UNAUTHENTICATED' || failure.code === 'SESSION_EXPIRED') {
      return `登录已失效，请重新登录档口账号；${action}未保存。`;
    }
    return `${action}未完成：${failure.message}`;
  }

  useEffect(() => {
    let alive = true;
    if (mode !== 'real') {
      setProfileHint(null);
      return () => {
        alive = false;
      };
    }
    void source.getProfile().then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setProfileHint(`共同服务 /merchant/profile 不可用：${result.error.message}`);
        return;
      }
      setProfileHint(
        result.data.onboardingStep === 'SHOP_CREATED'
          ? '服务端已有店铺资料；可继续新增菜品。'
          : result.data.onboardingStep === 'REGISTERED'
            ? '服务端已有商家资料，尚未创建店铺。'
            : '服务端尚未注册商家。',
      );
    });
    return () => {
      alive = false;
    };
  }, [mode, source]);

  function clearError(field: OnboardingField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function goToStep(target: Step) {
    if (target === 2 && !completed.merchant) return;
    if (target === 3 && !(completed.merchant && completed.shop)) return;
    setStep(target);
    setErrors({});
    clearFeedback();
  }

  function updateMerchant(field: keyof MerchantRegistrationDraft, value: string) {
    setMerchant((current) => ({ ...current, [field]: value }));
    setCompleted({ merchant: false, shop: false, dish: false });
    setDishPreview(null);
    clearFeedback();
    clearError(field);
  }

  function updateShop(field: keyof ShopDraft, value: string) {
    setShop((current) => ({ ...current, [field]: value }));
    setCompleted((current) => ({ ...current, shop: false, dish: false }));
    setDishPreview(null);
    clearFeedback();
    clearError(field);
  }

  function updateDish(field: keyof NewDishDraft, value: string) {
    setDish((current) => ({ ...current, [field]: value }));
    setCompleted((current) => ({ ...current, dish: false }));
    setDishPreview(null);
    clearFeedback();
    clearError(field);
  }

  async function submitMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const result = validateMerchantRegistration(merchant);
    if (!result.ok) {
      setErrors(result.errors);
      clearFeedback();
      return;
    }
    setSaving('merchant');
    clearFeedback();
    try {
      const saved = await source.registerMerchant({
        ...result.value,
        requestId: createRequestId('merchant-registration'),
      });
      if (!saved.ok) {
        error(onboardingErrorText(saved.error, '商家注册'));
        return;
      }
      setMerchant(result.value);
      setErrors({});
      info(mode === 'sample'
        ? '样例模式已保存商家资料到本机样例内存（未连接服务端；学生端不可见）。'
        : '服务端已保存商家资料；请继续创建店铺。');
      setCompleted({ merchant: true, shop: false, dish: false });
      setDishPreview(null);
      setStep(2);
    } finally {
      setSaving(null);
    }
  }

  async function submitShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!completed.merchant) {
      error('请先完成商家注册资料。');
      setStep(1);
      return;
    }
    const merchantCheck = validateMerchantRegistration(merchant);
    if (!merchantCheck.ok) {
      setErrors(merchantCheck.errors);
      error('商家资料已修改且不再有效，请重新检查。');
      setCompleted({ merchant: false, shop: false, dish: false });
      setStep(1);
      return;
    }
    const result = validateShop(shop);
    if (!result.ok) {
      setErrors(result.errors);
      clearFeedback();
      return;
    }
    setSaving('shop');
    clearFeedback();
    try {
      const saved = await source.createShop({
        ...result.value,
        requestId: createRequestId('merchant-shop'),
      });
      if (!saved.ok) {
        error(onboardingErrorText(saved.error, '店铺创建'));
        return;
      }
      setShop(result.value);
      setErrors({});
      info(mode === 'sample'
        ? '样例模式已保存店铺到本机样例内存（未连接服务端；学生端不可见）。'
        : '服务端已保存店铺；请继续新增菜品。');
      setCompleted((current) => ({ ...current, shop: true, dish: false }));
      setDishPreview(null);
      setStep(3);
    } finally {
      setSaving(null);
    }
  }

  async function submitDish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!completed.shop) {
      error('请先完成店铺创建资料。');
      setStep(2);
      return;
    }
    const merchantCheck = validateMerchantRegistration(merchant);
    if (!merchantCheck.ok) {
      setErrors(merchantCheck.errors);
      error('商家资料已修改且不再有效，请重新检查。');
      setCompleted({ merchant: false, shop: false, dish: false });
      setStep(1);
      return;
    }
    const shopCheck = validateShop(shop);
    if (!shopCheck.ok) {
      setErrors(shopCheck.errors);
      error('店铺资料已修改且不再有效，请重新检查。');
      setCompleted((current) => ({ ...current, shop: false, dish: false }));
      setStep(2);
      return;
    }
    const result = validateNewDish(dish);
    if (!result.ok) {
      setErrors(result.errors);
      clearFeedback();
      return;
    }
    setSaving('dish');
    clearFeedback();
    try {
      const saved = await source.createDish({
        ...result.value,
        requestId: createRequestId('merchant-dish'),
      });
      if (!saved.ok) {
        error(onboardingErrorText(saved.error, '菜品创建'));
        return;
      }
      setDishPreview(result.value);
      setErrors({});
      setCompleted((current) => ({ ...current, dish: true }));
      info(mode === 'sample'
        ? '样例模式已新增菜品到本机样例菜单（仅样例数据，未连接服务端；学生端不可见）。'
        : '服务端已新增菜品；返回菜单后重新读取。');
      onDataChanged?.();
    } finally {
      setSaving(null);
    }
  }

  if (!allowed) {
    return (
      <div className="merchant-view" data-onboarding-blocked="true">
        <button type="button" className="back-link" onClick={onBack} data-onboarding-back>← 返回订单列表</button>
        <header className="merchant-view__header">
          <div>
            <h2>商家注册与开店</h2>
            <p className="lead">真实模式只能操作当前档口账号自己的店。</p>
          </div>
        </header>
        <div className="onboarding-lock">
          <strong>需要档口账号</strong>
          <p>未登录、学生或管理员账号不能进入开店流程，也不会读取任何店铺或菜品数据。</p>
          <p>
            当前身份：
            {session?.user.displayName ?? '未登录'}
            （{session?.user.role ?? '无角色'}）
          </p>
          <p>请到 #/system-check 登录档口演示账号后返回本页。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="merchant-view onboarding-page">
      <button type="button" className="back-link" onClick={onBack} data-onboarding-back>← 返回订单列表</button>
      <header className="merchant-view__header">
        <div>
          <h2>
            商家注册与开店
            <span className="merchant-readonly-tag">{mode === 'sample' ? '样例 · 本机内存' : '真实 · 共同服务'}</span>
          </h2>
          <p className="lead">
            {mode === 'sample'
              ? '按“商家注册 → 创建店铺 → 新增菜品”填写；样例保存只写入本机样例内存，学生端不可见。'
              : '按“商家注册 → 创建店铺 → 新增菜品”填写；真实保存调用共同服务，接口未提供时显示失败，不显示成功。'}
          </p>
        </div>
      </header>

      <div className="onboarding-lock" data-local-draft="true">
        <strong>{mode === 'sample' ? '样例模式 · 只写本机' : '真实模式 · 保存到共同服务'}</strong>
        <span>
          {mode === 'sample'
            ? '样例保存只写入本机样例内存；刷新或切换模式会丢失，学生端不可见。'
            : '真实保存调用 /merchant/registration、/merchant/shops、/merchant/menu；服务端未提供时显示失败，不显示成功。'}
        </span>
        <span>真实模式只能管理当前档口账号自己的店；页面不接收 merchantId 参数，服务端接通后由会话身份校验归属。</span>
        <span data-onboarding-identity>
          {mode === 'sample'
            ? '样例演示：不关联任何真实账号或店铺。'
            : `当前档口：${session?.user.displayName ?? ''}（${session?.user.merchantId ?? '无 merchantId'}）`}
        </span>
        {profileHint && <span data-onboarding-profile-hint>{profileHint}</span>}
      </div>

      <ol className="onboarding-steps" aria-label="开店步骤">
        {STEPS.map((item) => {
          const done = item.id === 1
            ? completed.merchant
            : item.id === 2
              ? completed.shop
              : completed.dish;
          const disabled = item.id === 2
            ? !completed.merchant
            : item.id === 3
              ? !completed.shop
              : false;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={step === item.id ? 'onboarding-step onboarding-step--active' : 'onboarding-step'}
                onClick={() => goToStep(item.id)}
                disabled={disabled || saving !== null}
                aria-current={step === item.id ? 'step' : undefined}
                data-step-link={item.id}
              >
                <span className="onboarding-step__index">{item.id}</span>
                {item.label}
                {done && <span className="onboarding-step__done">本地已填写</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <form className="detail-block onboarding-form" data-onboarding-step="1" onSubmit={submitMerchant} noValidate>
          <h3>1 商家注册</h3>
          <p className="hint">填写商家资料；共同服务将用这些字段创建商家并绑定当前档口账号。</p>
          <div className="onboarding-field">
            <label htmlFor="onboarding-merchant-name">商家名称</label>
            <input
              id="onboarding-merchant-name"
              value={merchant.merchantName}
              onChange={(event) => updateMerchant('merchantName', event.target.value)}
              maxLength={30}
              placeholder="例如：吉祥小馆"
              data-field="merchantName"
            />
            {errors.merchantName && <p className="field-error" role="alert" data-error="merchantName">{errors.merchantName}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-contact-name">联系人</label>
            <input
              id="onboarding-contact-name"
              value={merchant.contactName}
              onChange={(event) => updateMerchant('contactName', event.target.value)}
              maxLength={20}
              placeholder="例如：张三"
              data-field="contactName"
            />
            {errors.contactName && <p className="field-error" role="alert" data-error="contactName">{errors.contactName}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-contact-phone">联系电话</label>
            <input
              id="onboarding-contact-phone"
              value={merchant.contactPhone}
              onChange={(event) => updateMerchant('contactPhone', event.target.value)}
              inputMode="tel"
              maxLength={20}
              placeholder="11 位手机号"
              data-field="contactPhone"
            />
            {errors.contactPhone && <p className="field-error" role="alert" data-error="contactPhone">{errors.contactPhone}</p>}
          </div>
          <div className="action-bar">
            <button
              type="submit"
              className="action-button action-button--secondary"
              data-action="save-merchant"
              disabled={saving !== null}
              aria-busy={saving === 'merchant' || undefined}
            >
              {saving === 'merchant'
                ? '保存中…'
                : mode === 'sample' ? '校验并保存到样例，下一步' : '校验并提交注册'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className="detail-block onboarding-form" data-onboarding-step="2" onSubmit={submitShop} noValidate>
          <h3>2 创建店铺</h3>
          <p className="hint">店铺会绑定当前档口账号；页面不填写 merchantId，避免替别的店操作。</p>
          <p className="onboarding-summary" data-merchant-preview>
            商家草稿：{merchant.merchantName} · {merchant.contactName} · {merchant.contactPhone}
          </p>
          <div className="onboarding-field">
            <label htmlFor="onboarding-shop-name">店铺名称</label>
            <input
              id="onboarding-shop-name"
              value={shop.shopName}
              onChange={(event) => updateShop('shopName', event.target.value)}
              maxLength={30}
              placeholder="例如：吉祥小馆一店"
              data-field="shopName"
            />
            {errors.shopName && <p className="field-error" role="alert" data-error="shopName">{errors.shopName}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-shop-location">档口位置</label>
            <input
              id="onboarding-shop-location"
              value={shop.location}
              onChange={(event) => updateShop('location', event.target.value)}
              maxLength={50}
              placeholder="例如：一食堂二楼 3 号档口"
              data-field="location"
            />
            {errors.location && <p className="field-error" role="alert" data-error="location">{errors.location}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-shop-description">店铺简介（可选）</label>
            <textarea
              id="onboarding-shop-description"
              value={shop.description}
              onChange={(event) => updateShop('description', event.target.value)}
              maxLength={100}
              rows={3}
              placeholder="最多 100 个字符"
              data-field="description"
            />
            {errors.description && <p className="field-error" role="alert" data-error="description">{errors.description}</p>}
          </div>
          <div className="action-bar">
            <button type="button" className="action-button" onClick={() => goToStep(1)}>上一步</button>
            <button
              type="submit"
              className="action-button action-button--secondary"
              data-action="save-shop"
              disabled={saving !== null}
              aria-busy={saving === 'shop' || undefined}
            >
              {saving === 'shop'
                ? '保存中…'
                : mode === 'sample' ? '校验并保存到样例，下一步' : '校验并提交店铺'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="detail-block onboarding-form" data-onboarding-step="3" onSubmit={submitDish} noValidate>
          <h3>3 新增菜品</h3>
          <p className="hint">类型、名称、价格和可售数量为必填；新增菜品默认在售。{mode === 'sample' ? '样例模式会写入本机样例菜单。' : '真实模式调用共同服务保存。'}</p>
          <p className="onboarding-summary" data-shop-preview>
            店铺草稿：{shop.shopName} · {shop.location}
          </p>
          <div className="onboarding-field">
            <label htmlFor="onboarding-dish-type">菜品类型</label>
            <select
              id="onboarding-dish-type"
              value={dish.type}
              onChange={(event) => updateDish('type', event.target.value as DishType | '')}
              data-field="type"
            >
              <option value="">请选择类型</option>
              {DISH_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.type && <p className="field-error" role="alert" data-error="type">{errors.type}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-dish-name">菜品名称</label>
            <input
              id="onboarding-dish-name"
              value={dish.name}
              onChange={(event) => updateDish('name', event.target.value)}
              maxLength={30}
              placeholder="例如：招牌鸡肉饭"
              data-field="name"
            />
            {errors.name && <p className="field-error" role="alert" data-error="name">{errors.name}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-dish-price">价格（元）</label>
            <input
              id="onboarding-dish-price"
              value={dish.priceText}
              onChange={(event) => updateDish('priceText', event.target.value)}
              inputMode="decimal"
              placeholder="例如：18.50"
              data-field="priceText"
            />
            {errors.priceText && <p className="field-error" role="alert" data-error="priceText">{errors.priceText}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-dish-quantity">可售数量</label>
            <input
              id="onboarding-dish-quantity"
              value={dish.quantityText}
              onChange={(event) => updateDish('quantityText', event.target.value)}
              inputMode="numeric"
              placeholder="例如：30"
              data-field="quantityText"
            />
            {errors.quantityText && <p className="field-error" role="alert" data-error="quantityText">{errors.quantityText}</p>}
          </div>
          <div className="action-bar">
            <button type="button" className="action-button" onClick={() => goToStep(2)}>上一步</button>
            <button
              type="submit"
              className="action-button action-button--secondary"
              data-action="save-dish"
              disabled={saving !== null}
              aria-busy={saving === 'dish' || undefined}
            >
              {saving === 'dish'
                ? '保存中…'
                : mode === 'sample' ? '校验并保存到样例' : '校验并提交菜品'}
            </button>
          </div>
          {dishPreview && (
            <p className="onboarding-summary" data-dish-preview>
              菜品草稿：{DISH_TYPE_OPTIONS.find((option) => option.value === dishPreview.type)?.label} · {dishPreview.name} · ¥{(dishPreview.priceFen / 100).toFixed(2)} · 可售 {dishPreview.availableQuantity}
            </p>
          )}
        </form>
      )}

      {feedback && (
        <p
          className={feedbackError ? 'onboarding-feedback onboarding-feedback--error' : 'onboarding-feedback'}
          role={feedbackError ? 'alert' : 'status'}
          data-onboarding-feedback
          data-feedback-tone={feedbackError ? 'error' : 'info'}
        >
          {feedback}
        </p>
      )}

      <p className="hint" data-onboarding-scope>
        {mode === 'sample'
          ? '样例保存仅在当前页面内存，返回或刷新会丢失；学生端不可见。'
          : '真实模式保存依赖共同服务；接口未提供时显示失败，不显示成功。'}
        开店流程只影响商家、店铺与菜品资料；已有的接单、开始制作、标记可取和核销操作保持不变。
      </p>
    </div>
  );
}