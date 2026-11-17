import { useEffect, useState } from 'react';
import type { MerchantAccount, MerchantProfile, MerchantSource } from '../data/types';
import type { Session } from '../../../shared/session';
import { createRequestId } from '../../../shared/requestId';

interface MerchantMyInfoPageProps {
  mode: 'sample' | 'real';
  session: Session | null;
  source: MerchantSource;
  profile: MerchantProfile | null;
  onProfileChange: (profile: MerchantProfile) => void;
  onBack: () => void;
}

const ACCOUNT_PATTERN = /^[A-Za-z0-9._-]{4,30}$/;

export default function MerchantMyInfoPage({
  mode,
  session,
  source,
  profile,
  onProfileChange,
  onBack,
}: MerchantMyInfoPageProps) {
  const [account, setAccount] = useState<MerchantAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [accountInput, setAccountInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await source.getAccount();
      if (cancelled) return;
      if (!result.ok) {
        setError(`${result.error.message}${mode === 'sample' ? '' : '；请确认档口账号已登录。'}`);
        setLoading(false);
        return;
      }
      setAccount(result.data);
      setAccountInput(result.data.account);
      setContactName(result.data.contactName ?? '');
      setContactPhone(result.data.contactPhone ?? '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [source, mode]);

  async function save() {
    if (saving) return;
    setNotice('');
    setError('');
    const nextAccount = accountInput.trim();
    const nextPassword = passwordInput.trim();
    if (!ACCOUNT_PATTERN.test(nextAccount)) {
      setError('账号只能包含字母、数字、点、下划线或横线，长度 4—30。');
      return;
    }
    if (nextPassword.length > 0 && (nextPassword.length < 8 || /\s/.test(nextPassword))) {
      setError('新密码需为 8—64 位且不能包含空格。');
      return;
    }
    if (contactName.trim().length < 2 || contactName.trim().length > 20) {
      setError('联系人需为 2—20 个字符。');
      return;
    }
    if (!/^1\d{10}$/.test(contactPhone.trim())) {
      setError('请输入 11 位手机号。');
      return;
    }
    const id = requestId || createRequestId('merchant-account');
    setRequestId(id);
    setSaving(true);
    const result = await source.updateAccount({
      requestId: id,
      account: nextAccount === account?.account ? undefined : nextAccount,
      password: nextPassword.length > 0 ? nextPassword : undefined,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setAccount(result.data);
    setAccountInput(result.data.account);
    setPasswordInput('');
    setContactName(result.data.contactName ?? '');
    setContactPhone(result.data.contactPhone ?? '');
    setRequestId('');
    setNotice('已保存，管理端会同步显示最新账号与联系信息；下次登录请使用新账号密码。');
    const refreshed = await source.getProfile();
    if (refreshed.ok) onProfileChange(refreshed.data);
  }

  const merchantName = account?.merchantName ?? profile?.merchant?.name ?? session?.user.displayName ?? '当前离线';

  return (
    <div className="merchant-view merchant-my-info" data-merchant-my-info>
      <button type="button" className="back-link" onClick={onBack}>← 返回我的</button>
      <header className="merchant-view__header">
        <div>
          <h2>账号与联系信息</h2>
          <p className="lead">账号和密码会与管理端同步；修改后下次登录请使用新账号。</p>
        </div>
      </header>

      {loading ? (
        <p className="merchant-empty">正在读取账号信息…</p>
      ) : (
        <section className="detail-block">
          <dl className="onboarding-profile">
            <div>
              <dt>档口</dt>
              <dd>{merchantName}</dd>
            </div>
            <div>
              <dt>当前账号</dt>
              <dd>{account?.account ?? '未读取'}</dd>
            </div>
            <div>
              <dt>当前密码</dt>
              <dd>{account?.password ?? '未展示'}</dd>
            </div>
          </dl>
          <p className="hint">演示环境为便于管理端同步，会显示当前密码；正式上线应改为重置密码流程。</p>

          <div className="onboarding-field">
            <label htmlFor="merchant-account-account">登录账号</label>
            <input
              id="merchant-account-account"
              value={accountInput}
              maxLength={30}
              onChange={(event) => setAccountInput(event.target.value)}
              data-field="account"
            />
          </div>
          <div className="onboarding-field">
            <label htmlFor="merchant-account-password">新密码（留空表示不修改）</label>
            <input
              id="merchant-account-password"
              type="password"
              value={passwordInput}
              maxLength={64}
              onChange={(event) => setPasswordInput(event.target.value)}
              autoComplete="new-password"
              data-field="password"
            />
          </div>
          <div className="onboarding-field">
            <label htmlFor="merchant-account-contact">联系人</label>
            <input
              id="merchant-account-contact"
              value={contactName}
              maxLength={20}
              onChange={(event) => setContactName(event.target.value)}
              data-field="contactName"
            />
          </div>
          <div className="onboarding-field">
            <label htmlFor="merchant-account-phone">联系电话</label>
            <input
              id="merchant-account-phone"
              value={contactPhone}
              maxLength={11}
              inputMode="tel"
              onChange={(event) => setContactPhone(event.target.value)}
              data-field="contactPhone"
            />
          </div>

          {error && <p className="field-error" role="alert" data-my-info-error>{error}</p>}
          {notice && <p className="onboarding-feedback" role="status" data-my-info-notice>{notice}</p>}

          <div className="action-bar">
            <button type="button" className="action-button" onClick={onBack} disabled={saving}>取消</button>
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={() => void save()}
              disabled={saving}
              aria-busy={saving || undefined}
              data-action="save-account"
            >
              {saving ? '保存中…' : '保存账号信息'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}