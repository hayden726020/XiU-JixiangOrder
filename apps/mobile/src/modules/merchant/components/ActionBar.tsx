import type { OrderAction } from '../state/actionMatrix';

interface ActionBarProps {
  actions: OrderAction[];
  onAction: (action: OrderAction) => void;
  emptyText: string;
  pendingCode?: string | null;
  errorText?: string | null;
}

export default function ActionBar({
  actions,
  onAction,
  emptyText,
  pendingCode = null,
  errorText = null,
}: ActionBarProps) {
  if (actions.length === 0) {
    return (
      <>
        <p className="merchant-muted">{emptyText}</p>
        {errorText && <p className="action-feedback action-feedback--error" role="alert">{errorText}</p>}
      </>
    );
  }
  const state = errorText ? 'error' : pendingCode ? 'pending' : 'idle';
  return (
    <>
      <div className="action-bar" data-state={state}>
        {actions.map((action) => {
          const busy = pendingCode === action.code;
          return (
            <button
              key={action.code}
              type="button"
              className={`action-button action-button--${action.kind}`}
              onClick={() => onAction(action)}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? '提交中…' : action.label}
            </button>
          );
        })}
      </div>
      {pendingCode && (
        <p className="action-feedback action-feedback--pending" role="status" data-placeholder-state="pending">
          提交中（样例占位）：尚未发送真实请求，也不会改变订单状态。
        </p>
      )}
      {errorText && (
        <p className="action-feedback action-feedback--error" role="alert" data-placeholder-state="error">
          {errorText}
        </p>
      )}
    </>
  );
}