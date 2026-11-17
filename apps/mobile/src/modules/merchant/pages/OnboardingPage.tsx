import { useEffect, useState, type FormEvent } from 'react';
import { createRequestId } from '../../../shared/requestId';
import type { Session } from '../../../shared/session';
import type { QualificationFileInput, MerchantProfile, MerchantSource } from '../data/types';
import {
  canUseOnboarding,
  validateMerchantRegistration,
  validateShop,
  type MerchantRegistrationDraft,
  type OnboardingErrors,
  type OnboardingField,
  type ShopDraft,
} from '../state/onboarding';
import wallPhoto1 from '../assets/wall-1.webp';
import wallPhoto2 from '../assets/wall-2.webp';
import wallPhoto3 from '../assets/wall-3.webp';
import wallPhoto4 from '../assets/wall-4.webp';
import wallPhoto5 from '../assets/wall-5.webp';
import wallPhoto6 from '../assets/wall-6.webp';
import brandChef from '../assets/brand-chef.png';
import brandWordmark from '../assets/brand-wordmark-v2.png';

type Step = 1 | 2 | 3;

const MAX_QUALIFICATION_BYTES = 2 * 1024 * 1024;
const QUALIFICATION_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function readQualificationFile(file: File): Promise<QualificationFileInput> {
  return new Promise((resolve, reject) => {
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const mimeType = QUALIFICATION_MIME_BY_EXT[ext];
    if (!mimeType) {
      reject(new Error('仅支持 JPG、PNG、WebP 或 PDF 文件。'));
      return;
    }
    if (file.size > MAX_QUALIFICATION_BYTES) {
      reject(new Error('单个文件不能超过 2MB。'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      if (base64.length === 0) {
        reject(new Error('文件内容为空，请重新选择。'));
        return;
      }
      resolve({ fileName: file.name, mimeType, base64 });
    };
    reader.onerror = () => reject(new Error('读取文件失败，请重新选择。'));
    reader.readAsDataURL(file);
  });
}

interface OnboardingPageProps {
  mode: 'sample' | 'real';
  session: Session | null;
  source: MerchantSource;
  profile: MerchantProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  onProfileChange: (profile: MerchantProfile) => void;
  onBack: () => void;
  onCancel: () => void;
  onComplete: () => void;
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
  { id: 2, label: '资质审核' },
  { id: 3, label: '创建店铺' },
];

const WALL_PHOTOS = [
  wallPhoto1,
  wallPhoto2,
  wallPhoto3,
  wallPhoto4,
  wallPhoto5,
  wallPhoto6,
];

function OnboardingHero() {
  return (
    <section className="onboarding-hero" aria-label="食麦呼 · 档口端 与您一起，打造更好的食堂体验">
      <img
        className="onboarding-hero__wordmark"
        src={brandWordmark}
        alt="食麦呼 · 与您一起，打造更好的食堂体验"
      />
      <img className="onboarding-hero__chef" src={brandChef} alt="" aria-hidden="true" />
    </section>
  );
}

function OnboardingWallFrames({ reversed = false }: { reversed?: boolean }) {
  const photos = reversed ? [...WALL_PHOTOS].reverse() : [...WALL_PHOTOS];
  return (
    <>
      {[...photos, ...photos].map((src, index) => (
        <figure className="onboarding-wall__frame" key={`${src}-${index}`}>
          <span className="onboarding-wall__photo">
            <img src={src} alt="" />
          </span>
        </figure>
      ))}
    </>
  );
}

function OnboardingWall() {
  return (
    <div className="onboarding-wall" aria-hidden="true">
      <div className="onboarding-wall__row onboarding-wall__row--top">
        <OnboardingWallFrames />
      </div>
      <div className="onboarding-wall__row onboarding-wall__row--bottom">
        <OnboardingWallFrames reversed />
      </div>
    </div>
  );
}

export default function OnboardingPage({
  mode,
  session,
  source,
  profile,
  profileLoading,
  profileError,
  onProfileChange,
  onBack,
  onCancel,
  onComplete,
}: OnboardingPageProps) {
  const [step, setStep] = useState<Step>(1);
  const [merchant, setMerchant] = useState<MerchantRegistrationDraft>(EMPTY_MERCHANT);
  const [shop, setShop] = useState<ShopDraft>(EMPTY_SHOP);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [saving, setSaving] = useState<'merchant' | 'shop' | null>(null);
  const [completed, setCompleted] = useState({ merchant: false, shop: false });
  const [licenseFile, setLicenseFile] = useState<QualificationFileInput | null>(null);
  const [permitFile, setPermitFile] = useState<QualificationFileInput | null>(null);
  const [qualificationError, setQualificationError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [qualificationRequestId, setQualificationRequestId] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);

  const allowed = mode === 'sample'
    || canUseOnboarding(
      session?.user.role ?? null,
      session?.user.merchantId,
      session?.expiresAt ?? null,
    );

  const accountMerchantName = (() => {
    const raw = session?.user.displayName?.trim() ?? '';
    if (raw.length >= 2) return raw.slice(0, 20);
    return '档口商家';
  })();

  const serverMerchant = profile?.merchant ?? null;
  const serverShop = profile?.shop ?? null;
  const serverQualification = profile?.qualification ?? null;
  const qualificationApproved = serverQualification?.status === 'APPROVED';
  const serverCompleted = profile?.onboardingStep === 'SHOP_CREATED';

  const profileHint = mode !== 'real' || !profile
    ? null
    : profile.onboardingStep === 'SHOP_CREATED'
      ? '服务端已有店铺资料。'
      : profile.onboardingStep === 'REGISTERED'
        ? '服务端已有商家资料，尚未创建店铺。'
        : '服务端尚未注册商家。';

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
    if (!profile) return;
    if (profile.merchant) {
      setCompleted((current) => (current.merchant
        ? { ...current, shop: Boolean(profile.shop) }
        : { merchant: true, shop: Boolean(profile.shop) }));
    }
    if (profile.shop) {
      setCompleted({ merchant: profile.merchant !== null, shop: true });
      return;
    }
    if (profile.merchant) {
      if (profile.qualification?.status === 'APPROVED') setStep(3);
      else setStep(2);
    }
  }, [profile]);

  function clearError(field: OnboardingField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function goToStep(target: Step) {
    if (target >= 2 && !completed.merchant && serverMerchant === null) return;
    if (target === 3 && !qualificationApproved) return;
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
    const merchantDraft = { ...merchant, merchantName: accountMerchantName };
    const result = validateMerchantRegistration(merchantDraft);
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
      onProfileChange(saved.data);
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

  async function pickQualificationFile(kind: 'businessLicense' | 'foodPermit', file: File | null) {
    if (!file) return;
    setQualificationError(null);
    try {
      const parsed = await readQualificationFile(file);
      if (kind === 'businessLicense') setLicenseFile(parsed);
      else setPermitFile(parsed);
    } catch (failure) {
      setQualificationError(failure instanceof Error ? failure.message : '读取文件失败。');
    }
  }

  async function submitQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    if (!licenseFile || !permitFile) {
      setQualificationError('请先选择营业执照和食品经营许可证两个文件。');
      return;
    }
    setUploading(true);
    setQualificationError(null);
    const requestId = qualificationRequestId || createRequestId('merchant-qualification');
    setQualificationRequestId(requestId);
    const result = await source.submitQualification({
      requestId,
      businessLicense: licenseFile,
      foodPermit: permitFile,
    });
    setUploading(false);
    if (!result.ok) {
      setQualificationError(onboardingErrorText(result.error, '资质上传'));
      return;
    }
    onProfileChange(result.data);
    setQualificationRequestId('');
    setShowReviewModal(true);
  }

  async function refreshQualification() {
    const result = await source.getProfile();
    if (!result.ok) {
      error(onboardingErrorText(result.error, '审核状态刷新'));
      return;
    }
    onProfileChange(result.data);
    info('已刷新审核状态。');
  }

  async function mockApproveQualification() {
    if (!source.mockApproveQualification) return;
    const result = await source.mockApproveQualification();
    if (!result.ok) {
      error(result.error.message);
      return;
    }
    onProfileChange(result.data);
    info('样例模式已模拟管理端审核通过；真实模式必须由管理端审核。');
  }

  async function submitShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!completed.merchant && serverMerchant === null) {
      error('请先完成商家注册资料。');
      setStep(1);
      return;
    }
    if (!qualificationApproved) {
      error('请先上传营业执照与食品经营许可证，并等待管理端审核通过。');
      setStep(2);
      return;
    }
    if (serverMerchant === null) {
      const merchantCheck = validateMerchantRegistration({ ...merchant, merchantName: accountMerchantName });
      if (!merchantCheck.ok) {
        setErrors(merchantCheck.errors);
        error('商家资料已修改且不再有效，请重新检查。');
        setCompleted({ merchant: false, shop: false });
        setStep(1);
        return;
      }
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
      onProfileChange(saved.data);
      setShop(result.value);
      setErrors({});
      info(mode === 'sample'
        ? '样例模式已保存店铺到本机样例内存（未连接服务端；学生端不可见）。开店流程已完成。'
        : '服务端已保存店铺；开店流程已完成。');
      setCompleted((current) => ({ ...current, shop: true }));
      onComplete();
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

  if (profileLoading || (mode === 'sample' && profile === null && profileError === null)) {
    return (
      <div className="merchant-view onboarding-page">
        <OnboardingHero />
        <OnboardingWall />
        <section className="onboarding-overview" data-onboarding-loading="true">
          <header className="merchant-view__header">
            <div>
              <h2>商家注册 / 开店</h2>
              <p className="lead">正在读取当前档口账号的入驻状态…</p>
            </div>
          </header>
        </section>
      </div>
    );
  }

  if (serverCompleted && profile?.merchant && profile.shop) {
    return (
      <div className="merchant-view onboarding-page">
        <OnboardingHero />
        <OnboardingWall />
        <section className="onboarding-overview onboarding-completed" data-onboarding-completed="true">
          <header className="merchant-view__header">
            <div>
              <h2>已完成商家注册与开店</h2>
              <p className="lead">当前档口账号已在服务端完成入驻，退出后重新登录也不需要再次注册。</p>
            </div>
          </header>

          <dl className="onboarding-profile" data-onboarding-profile>
            <div>
              <dt>商家名称</dt>
              <dd>{profile.merchant.name}</dd>
            </div>
            <div>
              <dt>店铺负责人</dt>
              <dd>{profile.merchant.contactName ?? '未填写'}</dd>
            </div>
            <div>
              <dt>联系电话</dt>
              <dd>{profile.merchant.contactPhone ?? '未填写'}</dd>
            </div>
            <div>
              <dt>店铺名称</dt>
              <dd>{profile.shop.name}</dd>
            </div>
            <div>
              <dt>档口位置</dt>
              <dd>{profile.shop.location ?? '未填写'}</dd>
            </div>
            <div>
              <dt>店铺简介</dt>
              <dd>{profile.shop.description ?? '未填写'}</dd>
            </div>
          </dl>

          <p className="hint" data-onboarding-completed-hint>
            以上资料直接读取服务端 /merchant/profile；本页不再提交注册与开店请求。
          </p>

          <div className="onboarding-actions">
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={onComplete}
              data-action="leave-onboarding"
            >
              下一步：选择数据模式
            </button>
          </div>
        </section>

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
      </div>
    );
  }

  return (
    <div className="merchant-view onboarding-page">
      <OnboardingHero />
      <OnboardingWall />
      <section className="onboarding-overview" aria-labelledby="onboarding-title">
        <header className="merchant-view__header">
          <div>
            <h2 id="onboarding-title">商家注册 / 开店</h2>
            <p className="lead">按步骤完成商家注册、创建店铺。</p>
          </div>
        </header>

        <ol className="onboarding-steps" aria-label="开店步骤">
          {STEPS.map((item) => {
            const done = item.id === 1
              ? completed.merchant || serverMerchant !== null
              : item.id === 2
                ? qualificationApproved
                : completed.shop || serverShop !== null;
            const disabled = (item.id === 2 && !completed.merchant && serverMerchant === null)
              || (item.id === 3 && !qualificationApproved);
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
          {profileError && (
            <span data-onboarding-profile-error>
              共同服务 /merchant/profile 不可用：{profileError}
            </span>
          )}
        </div>
      )}

      {step === 1 && (
        serverMerchant !== null ? (
          <>
            <section className="onboarding-form onboarding-form--merchant" data-onboarding-server-merchant="true">
              <h3>1 商家注册</h3>
              <p className="hint">已有当前档口账号的商家资料，无需再次注册；下一步只需创建店铺。</p>
              <dl className="onboarding-profile">
                <div>
                  <dt>商家名称</dt>
                  <dd>{serverMerchant.name}</dd>
                </div>
                <div>
                  <dt>店铺负责人</dt>
                  <dd>{serverMerchant.contactName ?? '未填写'}</dd>
                </div>
                <div>
                  <dt>联系电话</dt>
                  <dd>{serverMerchant.contactPhone ?? '未填写'}</dd>
                </div>
              </dl>
            </section>
            <div className="onboarding-actions">
              <button
                type="button"
                className="action-button action-button--primary"
                onClick={() => goToStep(2)}
                data-action="continue-shop"
              >
                下一步：创建店铺
              </button>
              <button
                type="button"
                className="action-button onboarding-cancel"
                onClick={onCancel}
                data-action="cancel-onboarding"
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <form
              id="onboarding-merchant-form"
              className="onboarding-form onboarding-form--merchant"
              data-onboarding-step="1"
              onSubmit={submitMerchant}
              noValidate
            >
              <p className="hint" data-field-hint="merchantName">
                默认使用当前档口账号「{accountMerchantName}」，会显示在「我的」页面。
              </p>
              <div className="onboarding-field">

                <label htmlFor="onboarding-contact-name">店铺负责人</label>
                <input
                  id="onboarding-contact-name"
                  value={merchant.contactName}
                  onChange={(event) => updateMerchant('contactName', event.target.value)}
                  maxLength={20}
                  placeholder="店铺负责人，2—20 个字符"
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
                onClick={onCancel}
                disabled={saving !== null}
                data-action="cancel-onboarding"
              >
                取消
              </button>
            </div>
          </>
        )
      )}

      {step === 2 && (
        <form className="detail-block onboarding-form" data-onboarding-step="2" onSubmit={submitQualification} noValidate>
          <h3>2 资质审核</h3>
          <p className="hint">营业执照与食品经营许可证为开店必填项，缺一不可；提交后由管理端审核，预计一个工作日内完成。</p>
          {serverQualification && (
            <div
              className={`onboarding-status onboarding-status--${serverQualification.status.toLowerCase()}`}
              data-qualification-status={serverQualification.status}
            >
              <strong>
                {serverQualification.status === 'PENDING' && '审核中'}
                {serverQualification.status === 'APPROVED' && '审核通过'}
                {serverQualification.status === 'REJECTED' && '审核未通过'}
              </strong>
              <span>
                {serverQualification.status === 'PENDING' && '资质已提交，预计一个工作日内审核完毕。'}
                {serverQualification.status === 'APPROVED' && '管理端已通过，可以继续创建店铺。'}
                {serverQualification.status === 'REJECTED' && (serverQualification.reviewReason ?? '请修改资质后重新上传。')}
              </span>
              <span>营业执照：{serverQualification.businessLicense.fileName}</span>
              <span>食品经营许可证：{serverQualification.foodPermit.fileName}</span>
              <button
                type="button"
                className="action-button"
                onClick={() => void refreshQualification()}
                data-action="refresh-qualification"
              >
                刷新审核状态
              </button>
              {!qualificationApproved && mode === 'sample' && (
                <button
                  type="button"
                  className="action-button action-button--secondary"
                  onClick={() => void mockApproveQualification()}
                  data-action="mock-approve"
                >
                  样例：模拟管理端审核通过
                </button>
              )}
            </div>
          )}
          <div className="onboarding-field">
            <label htmlFor="onboarding-license">营业执照（JPG/PNG/WebP/PDF，≤2MB）</label>
            <input
              id="onboarding-license"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(event) => void pickQualificationFile('businessLicense', event.target.files?.[0] ?? null)}
              data-field="businessLicense"
            />
            {licenseFile && <p className="onboarding-summary">已选择：{licenseFile.fileName}</p>}
          </div>
          <div className="onboarding-field">
            <label htmlFor="onboarding-permit">食品经营许可证（JPG/PNG/WebP/PDF，≤2MB）</label>
            <input
              id="onboarding-permit"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(event) => void pickQualificationFile('foodPermit', event.target.files?.[0] ?? null)}
              data-field="foodPermit"
            />
            {permitFile && <p className="onboarding-summary">已选择：{permitFile.fileName}</p>}
          </div>
          {qualificationError && (
            <p className="field-error" role="alert" data-qualification-error>{qualificationError}</p>
          )}
          <div className="action-bar">
            <button type="button" className="action-button" onClick={() => goToStep(1)}>上一步</button>
            <button
              type="submit"
              className="action-button action-button--secondary"
              data-action="submit-qualification"
              disabled={uploading || saving !== null}
              aria-busy={uploading || undefined}
            >
              {uploading ? '提交中…' : qualificationApproved ? '重新提交审核' : '提交审核'}
            </button>
            {qualificationApproved && (
              <button
                type="button"
                className="action-button action-button--primary"
                onClick={() => goToStep(3)}
                data-action="continue-shop"
              >
                下一步：创建店铺
              </button>
            )}
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="detail-block onboarding-form" data-onboarding-step="3" onSubmit={submitShop} noValidate>
          <h3>3 创建店铺</h3>
          <p className="hint">店铺会绑定当前档口账号；页面不填写 merchantId，避免替别的店操作。</p>
          <p className="onboarding-summary" data-merchant-preview>
            {serverMerchant !== null
              ? `商家：${serverMerchant.name} · 负责人 ${serverMerchant.contactName ?? '未填写'} · ${serverMerchant.contactPhone ?? '未填写'}`
              : `商家：${accountMerchantName} · 负责人 ${merchant.contactName} · ${merchant.contactPhone}`}
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
            <button type="button" className="action-button" onClick={() => goToStep(2)}>上一步</button>
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

      {showReviewModal && (
        <div
          className="onboarding-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qualification-modal-title"
          data-review-modal
        >
          <div className="onboarding-modal__card">
            <h3 id="qualification-modal-title">资质已提交</h3>
            <p>营业执照与食品经营许可证已上传，预计在一个工作日内审核完毕。审核通过后即可创建店铺。</p>
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={() => setShowReviewModal(false)}
              data-action="close-review-modal"
            >
              知道了
            </button>
          </div>
        </div>
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