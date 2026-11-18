import { useEffect, useState, type FormEvent } from 'react';

import { createRequestId } from '../../../shared/requestId';
import type { Session } from '../../../shared/session';
import type { MerchantAccount, MerchantProfile, MerchantSource } from '../data/types';
import {
  resolveEffectiveMerchantName,
  validateMerchantContact,
  validateShop,
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

const ACCOUNT_PATTERN = /^[A-Za-z0-9._-]{4,30}$/;

function accountCheck(value: string): string | null {
  if (!ACCOUNT_PATTERN.test(value)) {
    return '账号只能包含字母、数字、点、下划线或横线，长度 4—30。';
  }
  return null;
}

function passwordCheck(value: string): string | null {
  if (value.length < 8 || value.length > 64) {
    return '密码需为 8—64 位。';
  }
  if (/\s/.test(value)) {
    return '密码不能包含空格。';
  }
  return null;
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
  const shop = profile?.shop ?? null;
  const merchantName = resolveEffectiveMerchantName({
    mode,
    session,
    serverMerchantName: merchant?.name ?? null,
    fallback: '未注册商家',
  });
  const storedPhone = merchant?.contactPhone ?? '';
  const phoneMasked = isMaskedPhone(storedPhone);

  const [merchantNameInput, setMerchantNameInput] = useState(merchantName);
  const [contactName, setContactName] = useState(merchant?.contactName ?? '');
  const [phoneInput, setPhoneInput] = useState(phoneMasked ? '' : storedPhone);
  const [shopName, setShopName] = useState(shop?.name ?? '');
  const [location, setLocation] = useState(shop?.location ?? '');
  const [description, setDescription] = useState(shop?.description ?? '');
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [account, setAccount] = useState<MerchantAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountInput, setAccountInput] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountNotice, setAccountNotice] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await source.getAccount();
      if (cancelled) return;
      if (!result.ok) {
        setAccount(null);
        setAccountError(result.error.message);
      } else {
        setAccount(result.data);
        setAccountInput(result.data.account);
      }
      setAccountLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  async function saveAccount() {
    if (accountSaving || accountLoading) return;
    setAccountNotice('');
    setAccountError('');
    const nextAccount = accountInput.trim();
    const invalid = accountCheck(nextAccount);
    if (invalid) {
      setAccountError(invalid);
      return;
    }
    if (nextAccount === account?.account) {
      setAccountNotice('账号未变化，无需保存。');
      return;
    }
    setAccountSaving(true);
    try {
      const result = await source.updateAccount({
        requestId: createRequestId('merchant-account'),
        account: nextAccount,
      });
      if (!result.ok) {
        setAccountError(
          result.error.code === 'ACCOUNT_TAKEN'
            ? '该账号已被使用，请换一个账号。'
            : result.error.message,
        );
        return;
      }
      setAccount(result.data);
      setAccountInput(result.data.account);
      setAccountNotice('账号已更新，管理端刷新即可看到；下次登录请使用新账号。');
    } finally {
      setAccountSaving(false);
    }
  }

  async function savePassword() {
    if (passwordSaving) return;
    setPasswordNotice('');
    setPasswordError('');
    const nextPassword = passwordInput;
    const invalid = passwordCheck(nextPassword);
    if (invalid) {
      setPasswordError(invalid);
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await source.updateAccount({
        requestId: createRequestId('merchant-account'),
        password: nextPassword,
      });
      if (!result.ok) {
        setPasswordError(result.error.message);
        return;
      }
      setAccount(result.data);
      setPasswordInput('');
      setPasswordNotice('密码已更新，管理端刷新即可看到；下次登录请使用新密码。');
    } finally {
      setPasswordSaving(false);
    }
  }

  useEffect(() => {
    const nextMerchant = profile?.merchant ?? null;
    const nextShop = profile?.shop ?? null;
    setMerchantNameInput(
      resolveEffectiveMerchantName({
        mode,
        session,
        serverMerchantName: nextMerchant?.name ?? null,
        fallback: '未注册商家',
      }),
    );
    setContactName(nextMerchant?.contactName ?? '');
    const phone = nextMerchant?.contactPhone ?? '';
    setPhoneInput(isMaskedPhone(phone) ? '' : phone);
    setShopName(nextShop?.name ?? '');
    setLocation(nextShop?.location ?? '');
    setDescription(nextShop?.description ?? '');
  }, [profile, mode, session]);

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
    const contactCheck = validateMerchantContact({
      merchantName: merchantNameInput,
      contactName,
      contactPhone: phoneChanged ? phoneInput : null,
    });
    const shopCheck = shop ? validateShop({ shopName, location, description }) : null;
    const nextErrors: OnboardingErrors = {
      ...(contactCheck.ok ? {} : contactCheck.errors),
      ...(shopCheck && !shopCheck.ok ? shopCheck.errors : {}),
    };
    if (Object.keys(nextErrors).length > 0 || !contactCheck.ok || (shopCheck && !shopCheck.ok)) {
      setErrors(nextErrors);
      setFeedback(null);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await source.updateProfile({
        requestId: createRequestId('merchant-profile'),
        merchantName: contactCheck.value.merchantName,
        contactName: contactCheck.value.contactName,
        ...(contactCheck.value.contactPhone === null ? {} : { contactPhone: contactCheck.value.contactPhone }),
        ...(shop && shopCheck?.ok
          ? {
            shopId: shop.id,
            shopVersion: shop.version,
            shopName: shopCheck.value.shopName,
            location: shopCheck.value.location,
            description: shopCheck.value.description,
          }
          : {}),
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
        ? '我的信息已保存到本机样例数据，入驻完成页与「我的」页面会同步更新。'
        : '我的信息已保存到服务端，入驻完成页与「我的」页面同步更新。');
    } finally {
      setSaving(false);
    }
  }

  const accountSection = (
    <section className="merchant-my-info__account" aria-label="账号与密码">
      <h3 className="merchant-my-info__section">账号与密码</h3>
      <p className="merchant-my-info__account-note">
        账号与密码会与管理端同步；修改后请使用新账号或新密码登录。
      </p>

      <div className="merchant-my-info__account-card">
        <div className="merchant-my-info__field">
          <label htmlFor="merchant-my-info-account">登录账号</label>
          <input
            id="merchant-my-info-account"
            value={accountLoading ? '' : accountInput}
            onChange={(event) => {
              setAccountInput(event.target.value);
              setAccountError('');
              setAccountNotice('');
            }}
            maxLength={30}
            placeholder={accountLoading ? '正在读取当前账号…' : '4—30 位字母、数字、点、下划线或横线'}
            autoComplete="username"
            disabled={accountLoading}
            data-my-info-field="account"
          />
          {accountError && (
            <p className="merchant-my-info__error" role="alert" data-my-info-error="account">
              {accountError}
            </p>
          )}
        </div>
        <button
          type="button"
          className="merchant-my-info__submit merchant-my-info__submit--inline"
          onClick={() => void saveAccount()}
          disabled={accountSaving || accountLoading}
          aria-busy={accountSaving || undefined}
          data-my-info-save-account
        >
          {accountSaving ? '保存中…' : '保存账号'}
        </button>
        {accountNotice && (
          <p className="merchant-my-info__account-ok" role="status" data-my-info-account-notice>
            {accountNotice}
          </p>
        )}
      </div>

      <div className="merchant-my-info__account-card">
        <div className="merchant-my-info__field">
          <label htmlFor="merchant-my-info-current-password">当前密码</label>
          <strong id="merchant-my-info-current-password" className="merchant-my-info__password" data-my-info-current-password>
            {accountLoading ? '读取中…' : account?.password ?? '未展示'}
          </strong>
        </div>
        <div className="merchant-my-info__field">
          <label htmlFor="merchant-my-info-password">新密码</label>
          <input
            id="merchant-my-info-password"
            type="password"
            value={passwordInput}
            onChange={(event) => {
              setPasswordInput(event.target.value);
              setPasswordError('');
              setPasswordNotice('');
            }}
            maxLength={64}
            placeholder="8—64 位，不能包含空格"
            autoComplete="new-password"
            data-my-info-field="password"
          />
          {passwordError && (
            <p className="merchant-my-info__error" role="alert" data-my-info-error="password">
              {passwordError}
            </p>
          )}
        </div>
        <button
          type="button"
          className="merchant-my-info__submit merchant-my-info__submit--inline"
          onClick={() => void savePassword()}
          disabled={passwordSaving}
          aria-busy={passwordSaving || undefined}
          data-my-info-save-password
        >
          {passwordSaving ? '保存中…' : '保存密码'}
        </button>
        {passwordNotice && (
          <p className="merchant-my-info__account-ok" role="status" data-my-info-password-notice>
            {passwordNotice}
          </p>
        )}
      </div>
    </section>
  );

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
        {accountSection}
      </section>
    );
  }

  return (
    <section className="merchant-my-info" aria-label="我的信息">
      <button type="button" className="merchant-my-info__back" onClick={onBack}>
        ← 返回我的
      </button>
      <h2 className="merchant-my-info__title">我的信息</h2>

      {accountSection}

      <form className="merchant-my-info__form" onSubmit={submit} noValidate>
        <h3 className="merchant-my-info__section">个人信息</h3>

        <div className="merchant-my-info__field">
          <label htmlFor="merchant-my-info-merchant-name">商家名称</label>
          <input
            id="merchant-my-info-merchant-name"
            value={merchantNameInput}
            onChange={(event) => {
              setMerchantNameInput(event.target.value);
              clearError('merchantName');
              setFeedback(null);
            }}
            maxLength={30}
            placeholder="商家名称，2—30 个字符"
            autoComplete="organization"
            data-my-info-field="merchantName"
            data-my-info-merchant-name
          />
          {errors.merchantName && (
            <p className="merchant-my-info__error" role="alert" data-my-info-error="merchantName">
              {errors.merchantName}
            </p>
          )}
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

        {shop ? (
          <>
            <h3 className="merchant-my-info__section">店铺资料</h3>

            <div className="merchant-my-info__field">
              <label htmlFor="merchant-my-info-shop-name">店铺名称</label>
              <input
                id="merchant-my-info-shop-name"
                value={shopName}
                onChange={(event) => {
                  setShopName(event.target.value);
                  clearError('shopName');
                  setFeedback(null);
                }}
                maxLength={30}
                placeholder="店铺名称，2—30 个字符"
                data-my-info-field="shopName"
              />
              {errors.shopName && (
                <p className="merchant-my-info__error" role="alert" data-my-info-error="shopName">
                  {errors.shopName}
                </p>
              )}
            </div>

            <div className="merchant-my-info__field">
              <label htmlFor="merchant-my-info-location">档口位置</label>
              <input
                id="merchant-my-info-location"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  clearError('location');
                  setFeedback(null);
                }}
                maxLength={50}
                placeholder="例如：一食堂二楼 3 号档口"
                data-my-info-field="location"
              />
              {errors.location && (
                <p className="merchant-my-info__error" role="alert" data-my-info-error="location">
                  {errors.location}
                </p>
              )}
            </div>

            <div className="merchant-my-info__field">
              <label htmlFor="merchant-my-info-description">店铺简介（可选）</label>
              <textarea
                id="merchant-my-info-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearError('description');
                  setFeedback(null);
                }}
                maxLength={100}
                rows={3}
                placeholder="最多 100 个字符"
                data-my-info-field="description"
              />
              {errors.description && (
                <p className="merchant-my-info__error" role="alert" data-my-info-error="description">
                  {errors.description}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="merchant-my-info__notice" role="status">
            当前账号尚未创建店铺；完成开店后，店铺名称、档口位置与店铺简介会显示在这里并可以修改。
          </p>
        )}

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
          : '真实模式：商家联系人提交 /merchant/profile，店铺资料提交 /merchant/shops/{id}；服务端拒绝时显示失败，不显示成功。'}
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