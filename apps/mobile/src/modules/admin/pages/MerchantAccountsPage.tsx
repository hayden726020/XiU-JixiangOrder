import { useEffect, useState, type FormEvent } from 'react';
import type { AdminMerchantAccount } from '../types';
import type { AdminSource } from '../data/source';
import { createRequestId } from '../../../shared/requestId';

interface MerchantAccountsPageProps {
  source: AdminSource;
}

interface AccountForm {
  account: string;
  password: string;
  merchantName: string;
  contactName: string;
  contactPhone: string;
}

const EMPTY_FORM: AccountForm = {
  account: '',
  password: '',
  merchantName: '',
  contactName: '',
  contactPhone: '',
};

export default function MerchantAccountsPage({ source }: MerchantAccountsPageProps) {
  const [accounts, setAccounts] = useState<AdminMerchantAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setAccounts(await source.listMerchantAccounts());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '商家账号读取失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(field: keyof AccountForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setNotice('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    if (!/^[A-Za-z0-9._-]{4,30}$/.test(form.account.trim())) {
      setError('账号只能包含字母、数字、点、下划线或横线，长度 4—30。');
      return;
    }
    if (form.password.length < 8 || /\s/.test(form.password)) {
      setError('初始密码需为 8—64 位且不能包含空格。');
      return;
    }
    if (form.merchantName.trim().length < 2 || form.merchantName.trim().length > 30) {
      setError('商家名称需为 2—30 个字符。');
      return;
    }
    if (form.contactName.trim().length < 2 || form.contactName.trim().length > 20) {
      setError('联系人需为 2—20 个字符。');
      return;
    }
    if (!/^1\d{10}$/.test(form.contactPhone.trim())) {
      setError('请输入 11 位手机号。');
      return;
    }
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const created = await source.createMerchantAccount({
        requestId: createRequestId('admin-merchant-account'),
        account: form.account.trim(),
        password: form.password,
        merchantName: form.merchantName.trim(),
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
      });
      setAccounts((current) => [...current, created]);
      setForm(EMPTY_FORM);
      setNotice(`已生成商家账号「${created.account}」，初始密码已保存；商家端修改后这里刷新即同步。`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '商家账号生成失败。');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-settings admin-accounts" data-admin-merchant-accounts>
      <header className="admin-orders__header">
        <h2 className="admin-orders__title">商家账号</h2>
        <p className="admin-muted">在此生成并存储档口登录账号；商家端修改账号或密码后，刷新此页即可看到最新信息。</p>
      </header>

      {error && <p className="check-error" role="alert" data-admin-error>{error}</p>}
      {notice && <p className="check-ok" role="status" data-admin-notice>{notice}</p>}
      {loading ? <p className="admin-orders__loading">正在读取商家账号…</p> : null}

      <form className="admin-settings__card admin-accounts__form" onSubmit={submit} noValidate>
        <h3>生成商家账号</h3>
        <div className="admin-accounts__grid">
          <label>
            登录账号
            <input
              value={form.account}
              onChange={(event) => update('account', event.target.value)}
              maxLength={30}
              placeholder="例如：kaidian-01"
              data-field="account"
            />
          </label>
          <label>
            初始密码
            <input
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              maxLength={64}
              autoComplete="new-password"
              data-field="password"
            />
          </label>
          <label>
            商家名称
            <input
              value={form.merchantName}
              onChange={(event) => update('merchantName', event.target.value)}
              maxLength={30}
              data-field="merchantName"
            />
          </label>
          <label>
            联系人
            <input
              value={form.contactName}
              onChange={(event) => update('contactName', event.target.value)}
              maxLength={20}
              data-field="contactName"
            />
          </label>
          <label>
            联系电话
            <input
              value={form.contactPhone}
              onChange={(event) => update('contactPhone', event.target.value)}
              maxLength={11}
              inputMode="tel"
              data-field="contactPhone"
            />
          </label>
        </div>
        <div className="action-bar">
          <button
            type="submit"
            className="action-button action-button--primary"
            disabled={creating}
            aria-busy={creating || undefined}
            data-action="create-merchant-account"
          >
            {creating ? '生成中…' : '生成并保存账号'}
          </button>
          <button type="button" className="action-button" onClick={() => void load()} data-action="refresh-accounts">
            刷新同步
          </button>
        </div>
      </form>

      <ul className="admin-order-list">
        {accounts.map((item) => (
          <li key={item.userId} className="admin-settings__card admin-accounts__card">
            <div className="admin-review__head">
              <strong>{item.shopName ?? item.merchantName ?? '未绑定商家'}</strong>
              <span className={`admin-tag admin-tag--${item.active ? 'ready' : 'cancelled'}`}>
                {item.active ? '启用' : '停用'}
              </span>
            </div>
            <dl className="admin-settings__kv">
              <div>
                <dt>商家名称</dt>
                <dd>{item.merchantName ?? '未绑定商家'}</dd>
              </div>
              <div>
                <dt>店铺名称</dt>
                <dd>{item.shopName ?? '未创建店铺'}</dd>
              </div>
              <div>
                <dt>登录账号</dt>
                <dd>{item.account}</dd>
              </div>
              <div>
                <dt>当前密码</dt>
                <dd>{item.password ?? '未记录'}</dd>
              </div>
              <div>
                <dt>联系人</dt>
                <dd>{item.contactName ?? '未填写'} · {item.contactPhone ?? '未填写'}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}