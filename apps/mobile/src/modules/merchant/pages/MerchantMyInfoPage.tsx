import { useEffect, useState, type FormEvent } from 'react';

import { createRequestId } from '../../../shared/requestId';
import type { Session } from '../../../shared/session';
import type { MerchantProfile, MerchantSource } from '../data/types';
import {
  validateMerchantContact,
  type OnboardingErrors,
} from '../state/onboarding';

interface MerchantMyInfoPageProps {
  mode: 'sample' | 'real';
  session: Session | null;
  source: MerchantSource;
  profile: MerchantProfile | null;
  onProfileChange: (profile: MerchantProfile) => void;
  onBack: () => void;
}

function isMaskedPhone(value: string): boolean {
  return value.includes('*');
}

export default function MerchantMyInfoPage({
  mode,
  session,
  source,
  profile,
  onProfileChange,
  onBack,
}: MerchantMyInfoPageProps) {
  const merchant = profile?.merchant ?? null;
  const merchantName = merchant?.name ?? session?.user.displayName ?? '未注册商家';
  const storedPhone = merchant?.contactPhone ?? '';
  const phoneMasked = isMaskedPhone(storedPhone);

  const [contactName, setContactName] = useState(merchant?.contactName ?? '');
  const [phoneInput, setPhoneInput] = useState(phoneMasked ? '' : storedPhone);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = profile?.merchant ?? null;
    setContactName(next?.contactName ?? '');
    const phone = next?.contactPhone ?? '';
    setPhoneInput(isMaskedPhone(phone) ? '' : phone);
  }, [profile]);

  function info(text: string) {
    setFeedback(text);
    setFeedbackError(false);
  }

  function error(text: string) {
    setFeedback(text);
    setFeedbackError(true);
  }

  function clearError(field: keyof OnboardingErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!merchant) {
      error('当前账号还没有商家资料，请先完成商家注册。');
      return;
    }
    const phoneChanged = phoneInput.trim().length > 0;
    const check = validateMerchantContact({
      contactName,
      contactPhone: phoneChanged ? phoneInput : phoneMasked ? null : '',
    });
    if (!check.ok) {
      setErrors(check.errors);
      setFeedback(null);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await source.updateProfile({
        requestId: createRequestId('merchant-profile'),
        contactName: check.value.contactName,
        ...(check.value.contactPhone === null ? {} : { contactPhone: check.value.contactPhone }),
      });
      if (!saved.ok) {
        if (saved.error.code === 'ONBOARDING_API_MISSING') {
          error(saved.error.message);
        } else if (saved.error.code === 'UNAUTHENTICATED' || saved.error.code === 'SESSION_EXPIRED') {
          error('登录已失效，请重新登录档口账号；本次修改未保存。');
        } else {
          error(`资料保存未完成：${saved.error.message}`);
        }
        return;
      }
      onProfileChange(saved.data);
      setErrors({});
      const nextPhone = saved.data.merchant?.contactPhone ?? '';
      setPhoneInput(isMaskedPhone(nextPhone) ? '' : nextPhone);
      info(mode === 'sample'
        ? '我的信息已保存到本机样例数据，注册资料与「我的」页面会同步更新。'
        : '我的信息已保存到服务端，「我的」页面与注册资料同步更新。');
    } finally {
      setSaving(false);
    }
  }

  if (!merchant) {
    return (
      <section className="merchant-my-info" aria-label="我的信息">
        <button type="button" className="merchant-my-info__back" onClick={onBack}>
          ← 返回我的
        </button>
        <h2 className="merchant-my-info__title">我的信息</h2>
        <p className="merchant-my-info__notice" role="status">
          当前账号还没有商家资料，请先完成商家注册，再回到这里查看和修改个人信息。
        </p>
      </section>
    );
  }

  return (
    <section className="merchant-my-info" aria-label="我的信息">
      <button type="button" className="merchant-my-info__back" onClick={onBack}>
        ← 返回我的
      </button>
      <h2 className="merchant-my-info__title">我的信息</h2>

      <form className="merchant-my-info__form" onSubmit={submit} noValidate>
        <div className="merchant-my-info__readonly">
          <span>商家名称</span>
          <strong data-my-info-merchant-name>{merchantName}</strong>
          <p>商家名称跟随当前档口登录账号，不能单独修改。</p>
        </div>

        <div className="merchant-my-info__field">
          <label htmlFor="merchant-my-info-name">店铺负责人</label>
          <input
            id="merchant-my-info-name"
            value={contactName}
            onChange={(event) => {
              setContactName(event.target.value);
              clearError('contactName');
              setFeedback(null);
            }}
            maxLength={20}
            placeholder="店铺负责人，2—20 个字符"
            autoComplete="name"
            data-my-info-field="contactName"
          />
          {errors.contactName && (
            <p className="merchant-my-info__error" role="alert" data-my-info-error="contactName">
              {errors.contactName}
            </p>
          )}
        </div>

        <div className="merchant-my-info__field">
          <label htmlFor="merchant-my-info-phone">联系电话</label>
          <input
            id="merchant-my-info-phone"
            value={phoneInput}
            onChange={(event) => {
              setPhoneInput(event.target.value);
              clearError('contactPhone');
              setFeedback(null);
            }}
            inputMode="tel"
            maxLength={11}
            placeholder={phoneMasked ? `当前号码已隐藏（${storedPhone}），输入新的 11 位手机号才会修改` : '11 位手机号'}
            autoComplete="tel"
            data-my-info-field="contactPhone"
          />
          {errors.contactPhone && (
            <p className="merchant-my-info__error" role="alert" data-my-info-error="contactPhone">
              {errors.contactPhone}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="merchant-my-info__submit"
          disabled={saving}
          aria-busy={saving || undefined}
          data-my-info-save
        >
          {saving ? '保存中…' : '保存我的信息'}
        </button>
      </form>

      <p className="merchant-my-info__hint" data-my-info-hint>
        {mode === 'sample'
          ? '样例模式：修改只写入本机样例数据，用于演示资料同步；不会影响真实商家档案。'
          : '真实模式：保存调用 /merchant/profile；服务端未提供该接口时显示失败，不显示成功。'}
      </p>

      {feedback && (
        <p
          className={feedbackError ? 'merchant-my-info__feedback merchant-my-info__feedback--error' : 'merchant-my-info__feedback'}
          role={feedbackError ? 'alert' : 'status'}
          data-my-info-feedback
          data-feedback-tone={feedbackError ? 'error' : 'info'}
        >
          {feedback}
        </p>
      )}
    </section>
  );
}