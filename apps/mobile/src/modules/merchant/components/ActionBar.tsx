import type { OrderAction } from '../state/actionMatrix';

interface ActionBarProps {
  actions: OrderAction[];
  onAction: (action: OrderAction) => void;
  emptyText: string;
}

export default function ActionBar({ actions, onAction, emptyText }: ActionBarProps) {
  if (actions.length === 0) {
    return <p className="merchant-muted">{emptyText}</p>;
  }
  return (
    <div className="action-bar">
      {actions.map((action) => (
        <button
          key={action.code}
          type="button"
          className={`action-button action-button--${action.kind}`}
          onClick={() => onAction(action)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}