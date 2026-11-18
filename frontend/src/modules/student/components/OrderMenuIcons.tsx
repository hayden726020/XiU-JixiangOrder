import type { ReactNode } from 'react';

export type MenuIconName = 'shop' | 'calendar' | 'receipt' | 'basket' | 'home' | 'bowl' | 'user' | 'chevron' | 'cloche' | 'pepper';

export default function OrderMenuIcon({ name, size = 24 }: { name: MenuIconName; size?: number }) {
  const paths: Record<MenuIconName, ReactNode> = {
    shop: <><path d="M3 10 5 4h14l2 6v2a3 3 0 0 1-5.5 1.6A3 3 0 0 1 10 13.6 3 3 0 0 1 4.5 12 3 3 0 0 1 3 10Z" /><path d="M5 15v6h14v-6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-11 5 2 2 4-4" /></>,
    receipt: <><path d="M5 3h14v18l-2-1.5-2 1.5-3-1.5-3 1.5-2-1.5L5 21V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    basket: <><path d="m3 10 2 11h14l2-11H3Zm4 0 3-7m7 7-3-7M8 15v2m4-2v2m4-2v2" /></>,
    home: <><path d="m3 10 9-7 9 7v11H3V10Z" /><path d="M9 21v-7h6v7" /></>,
    bowl: <><path d="M3 12h18a9 9 0 0 1-18 0ZM5 21h14M9 8c0-2 2-2 2-4m4 5c0-2 2-2 2-4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    cloche: <><path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 10V8m-2 0h4M2 20h20" /></>,
    pepper: <><path d="M17 4c-1 3-3 3-4 4 3 2 2 5-1 8-3 3-6 3-9 3 4-2 5-5 6-8 1-2 3-4 6-4M17 4c1-1 3-1 4 0" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
