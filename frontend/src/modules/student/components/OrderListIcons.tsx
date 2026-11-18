import type { ReactNode } from 'react';

export type OrderListIconName = 'clipboard' | 'clock' | 'checkSquare' | 'refund' | 'search' | 'headset' | 'check' | 'cooking' | 'pin' | 'utensils' | 'qr' | 'bell' | 'chat' | 'close';

export default function OrderListIcon({ name, size = 22 }: { name: OrderListIconName; size?: number }) {
  const paths: Record<OrderListIconName, ReactNode> = {
    clipboard: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
    checkSquare: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m7 12 3 3 7-7" /></>,
    refund: <><path d="M4 9a8 8 0 1 1-1 6M4 4v5h5" /><path d="M9 9h6m-3-3v12m-3-4h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
    headset: <><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13H3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-7H4Zm16 0h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7h1ZM19 20c0 2-2 3-5 3h-2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" /></>,
    cooking: <><path d="M5 14h14a7 7 0 0 1-14 0ZM4 21h16M9 2c0 2-2 2-2 4m6-4c0 2-2 2-2 4m6-4c0 2-2 2-2 4" /></>,
    pin: <><path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13Z" /><circle cx="12" cy="9" r="2" /></>,
    utensils: <><path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M13 2v7a3 3 0 0 0 6 0V2m-3 0v20" /></>,
    qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3m4 0v3h-3m-4 1v3h3m4-1v1h-2" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    chat: <><path d="M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.8-5A9 9 0 1 1 21 11Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
    close: <path d="M5 5 19 19M19 5 5 19" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
