import { useEffect, useState, type FormEvent } from 'react';
import { createRequestId } from '../../../shared/requestId';
import type { Session } from '../../../shared/session';
import type { MerchantSource } from '../data/types';
import {
  canUseOnboarding,
  validateMerchantRegistration,
  validateShop,
  type MerchantRegistrationDraft,
  type OnboardingErrors,
  type OnboardingField,
  type ShopDraft,
} from '../state/onboarding';

type Step = 1 | 2;

interface OnboardingPageProps {
  mode: 'sample' | 'real';
  session: Session | null;
  source: MerchantSource;
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

const STEPS: ReadonlyArray<{ id: Step; label: string }> = [
  { id: 1, label: '商家注册' },
  { id: 2, label: '创建店铺' },
];

export default function OnboardingPage({
  mode,
  session,
  source,
  onBack,
}: OnboardingPageProps) {
  const [step, setStep] = useState<Step>(1);
  const [merchant, setMerchant] = useState<MerchantRegistrationDraft>(EMPTY_MERCHANT);
  const [shop, setShop] = useState<ShopDraft>(EMPTY_SHOP);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [profileHint, setProfileHint] = useState<string | null>(null);
  const [saving, setSaving] = useState<'merchant' | 'shop' | null>(null);
  const [completed, setCompleted] = useState({ merchant: false, shop: false });

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
          ? '服务端已有店铺资料。'
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
    setStep(target);
    setErrors({});
    clearFeedback();
  }

  function updateMerchant(field: keyof MerchantRegistrationDraft, value: string) {
    setMerchant((current) => ({ ...current, [field]: value }));
    setCompleted({ merchant: false, shop: false });
    clearFeedback();
    clearError(field);
  }

  function updateShop(field: keyof ShopDraft, value: string) {
    setShop((current) => ({ ...current, [field]: value }));
    setCompleted((current) => ({ ...current, shop: false }));
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
      setCompleted({ merchant: true, shop: false });
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
      setCompleted({ merchant: false, shop: false });
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
        ? '样例模式已保存店铺到本机样例内存（未连接服务端；学生端不可见）。开店流程已完成。'
        : '服务端已保存店铺；开店流程已完成。');
      setCompleted((current) => ({ ...current, shop: true }));
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
          <p>未登录、学生或管理员账号不能进入开店流程，也不会读取任何店铺资料。</p>
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
      <section className="onboarding-overview" aria-labelledby="onboarding-title">
        <header className="merchant-view__header">
          <div>
            <h2 id="onboarding-title">商家注册 / 开店</h2>
            <p className="lead">按步骤完成商家注册、创建店铺。</p>
          </div>
        </header>

        <ol className="onboarding-steps" aria-label="开店步骤">
          {STEPS.map((item) => {
            const done = item.id === 1 ? completed.merchant : completed.shop;
            const disabled = item.id === 2 && !completed.merchant;
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
                  <span>{item.label}</span>
                  {done && <span className="onboarding-step__done">已填写</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {mode === 'real' && (
        <div className="onboarding-lock" data-local-draft="true">
          <strong>真实模式 · 保存到共同服务</strong>
          <span>真实保存调用 /merchant/registration、/merchant/shops；服务端未提供时显示失败，不显示成功。</span>
          <span>只能管理当前档口账号自己的店；页面不接收 merchantId 参数，由会话身份校验归属。</span>
          <span data-onboarding-identity>
            当前档口：{session?.user.displayName ?? ''}（{session?.user.merchantId ?? '无 merchantId'}）
          </span>
          {profileHint && <span data-onboarding-profile-hint>{profileHint}</span>}
        </div>
      )}

      {step === 1 && (
        <>
          <form
            id="onboarding-merchant-form"
            className="onboarding-form onboarding-form--merchant"
            data-onboarding-step="1"
            onSubmit={submitMerchant}
            noValidate
          >
            <div className="onboarding-field">
              <label htmlFor="onboarding-merchant-name">商家名称</label>
              <input
                id="onboarding-merchant-name"
                value={merchant.merchantName}
                onChange={(event) => updateMerchant('merchantName', event.target.value)}
                maxLength={30}
                placeholder="合同主体名称，2—30 个字符"
                autoComplete="organization"
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
                placeholder="档口负责人，2—20 个字符"
                autoComplete="name"
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
                maxLength={11}
                placeholder="11 位手机号"
                autoComplete="tel"
                data-field="contactPhone"
              />
              {errors.contactPhone && <p className="field-error" role="alert" data-error="contactPhone">{errors.contactPhone}</p>}
            </div>
            <p className="onboarding-privacy">注册信息仅用于合同主体与联系，不展示给学生端。</p>
          </form>
          <div className="onboarding-actions">
            <button
              type="submit"
              form="onboarding-merchant-form"
              className="action-button action-button--primary"
              data-action="save-merchant"
              disabled={saving !== null}
              aria-busy={saving === 'merchant' || undefined}
            >
              {saving === 'merchant' ? '保存中…' : '下一步'}
            </button>
            <button
              type="button"
              className="action-button onboarding-cancel"
              onClick={onBack}
              disabled={saving !== null}
              data-action="cancel-onboarding"
            >
              取消
            </button>
          </div>
        </>
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
            {completed.shop ? (
              <button
                type="button"
                className="action-button action-button--primary"
                onClick={onBack}
                data-action="complete-onboarding"
              >
                完成
              </button>
            ) : (
              <button
                type="submit"
                className="action-button action-button--secondary"
                data-action="save-shop"
                disabled={saving !== null}
                aria-busy={saving === 'shop' || undefined}
              >
                {saving === 'shop'
                  ? '保存中…'
                  : mode === 'sample' ? '校验并保存店铺' : '校验并提交店铺'}
              </button>
            )}
          </div>
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

      {mode === 'real' && (
        <p className="hint" data-onboarding-scope>
          真实模式保存依赖共同服务；接口未提供时显示失败，不显示成功。
          开店流程只影响商家与店铺资料；已有的接单、开始制作、标记可取和核销操作保持不变。
        </p>
      )}
    </div>
  );
}