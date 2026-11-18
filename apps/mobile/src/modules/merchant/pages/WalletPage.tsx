import { useState } from 'react';
import type { WalletSummary } from '../data/types';
import { formatYuan } from '../utils/money';

export interface WalletPageProps {
  mode: 'sample' | 'real';
  wallet: WalletSummary | null;
  loading: boolean;
  error: string | null;
  withdrawInFlight: boolean;
  onWithdraw: (amountFen: number) => void;
  onBack: () => void;
}

export default function WalletPage({
  mode,
  wallet,
  loading,
  error,
  withdrawInFlight,
  onWithdraw,
  onBack,
}: WalletPageProps) {
  const [amountText, setAmountText] = useState('50');
  const [localError, setLocalError] = useState<string | null>(null);
  const walletUnavailable = mode === 'real';

  function submitWithdraw() {
    if (withdrawInFlight) return;
    const yuan = Number(amountText);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      setLocalError('提现金额必须大于 0。');
      return;
    }
    const amountFen = Math.round(yuan * 100);
    if (wallet && amountFen > wallet.balanceFen) {
      setLocalError('演示提现金额不能超过当前余额。');
      return;
    }
    setLocalError(null);
    onWithdraw(amountFen);
  }

  return (
    <section className="merchant-wallet" aria-label="钱包">
      <button type="button" className="merchant-wallet__back" onClick={onBack}>
        ← 返回我的
      </button>
      <h2 className="merchant-wallet__title">钱包</h2>

      {walletUnavailable ? (
        <div className="merchant-wallet__notice" role="status">
          钱包暂未接入共同服务；余额与提现以档口实际结算为准，此页仅展示说明，不使用样例数据冒充。
        </div>
      ) : null}

      {error ? <p className="merchant-wallet__error" role="alert">{error}</p> : null}

      <div className="merchant-wallet__balance-card">
        <span className="merchant-wallet__balance-label">
          {walletUnavailable ? '余额（暂未接通）' : '样例余额'}
        </span>
        <strong className="merchant-wallet__balance">
          {loading ? '读取中…' : wallet ? formatYuan(wallet.balanceFen) : '—'}
        </strong>
        <div className="merchant-wallet__stats">
          <span>累计收入 {wallet ? formatYuan(wallet.totalIncomeFen) : '—'}</span>
          <span>累计提现 {wallet ? formatYuan(wallet.totalWithdrawnFen) : '—'}</span>
        </div>
      </div>

      {!walletUnavailable && (
        <form
          className="merchant-wallet__withdraw"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithdraw();
          }}
        >
          <label htmlFor="merchant-wallet-amount">演示提现金额（元）</label>
          <input
            id="merchant-wallet-amount"
            type="number"
            min="1"
            step="1"
            value={amountText}
            disabled={withdrawInFlight}
            onChange={(event) => setAmountText(event.target.value)}
          />
          {localError ? <p className="merchant-wallet__error" role="alert">{localError}</p> : null}
          <button type="submit" className="merchant-wallet__submit" disabled={withdrawInFlight || !wallet}>
            {withdrawInFlight ? '正在提现…' : '演示提现'}
          </button>
          <p className="merchant-wallet__hint">
            样例模式演示：提现只从样例余额扣减，不产生真实资金流动。
          </p>
        </form>
      )}

      {!walletUnavailable && wallet ? (
        <div className="merchant-wallet__entries">
          <h3>收支明细</h3>
          {wallet.entries.length === 0 ? (
            <p className="merchant-wallet__empty">暂无收支记录。</p>
          ) : (
            wallet.entries.map((entry) => (
              <div key={entry.id} className="merchant-wallet__entry">
                <div className="merchant-wallet__entry-meta">
                  <span className="merchant-wallet__entry-label">{entry.label}</span>
                  <span className="merchant-wallet__entry-time">
                    {entry.createdAt.replace('T', ' ').slice(0, 16)}
                  </span>
                </div>
                <strong
                  className={
                    entry.kind === 'income'
                      ? 'merchant-wallet__amount merchant-wallet__amount--in'
                      : 'merchant-wallet__amount merchant-wallet__amount--out'
                  }
                >
                  {entry.kind === 'income' ? '+' : '-'}
                  {formatYuan(entry.amountFen)}
                </strong>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}