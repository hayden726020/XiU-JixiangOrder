import type { MouseEvent } from 'react';
import '../admin-back.css';

interface AdminBackLinkProps {
  to: string;
  label: string;
  onBack?: () => void;
}

export default function AdminBackLink({ to, label, onBack }: AdminBackLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (onBack) {
      onBack();
      return;
    }
    window.history.pushState(null, '', `#${to}`);
    window.dispatchEvent(new Event('hashchange'));
  };

  return (
    <a className="admin-back-link" href={`#${to}`} onClick={handleClick}>
      <span aria-hidden="true">←</span>
      {label}
    </a>
  );
}