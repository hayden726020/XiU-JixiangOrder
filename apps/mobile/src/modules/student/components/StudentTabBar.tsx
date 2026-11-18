import { useEffect, useState } from 'react';
import '../student-motion.css';

export type StudentTabId = 'home' | 'order' | 'orders' | 'profile';

const STUDENT_TABS: Array<{ id: StudentTabId; label: string }> = [
  { id: 'home', label: '首页' },
  { id: 'order', label: '点餐' },
  { id: 'orders', label: '订单' },
  { id: 'profile', label: '我的' },
];

function tabIndexOf(tab: StudentTabId): number {
  const index = STUDENT_TABS.findIndex((item) => item.id === tab);
  return index >= 0 ? index : 0;
}

function TabIcon({ tab }: { tab: StudentTabId }) {
  switch (tab) {
    case 'home':
      return <path d="m3 10 9-7 9 7v10H3zM9 21v-7h6v7" />;
    case 'order':
      return (
        <>
          <path d="M3 12h18a9 9 0 0 1-18 0ZM5 21h14" />
          <path d="M9 8c0-2 2-2 2-4m4 5c0-2 2-2 2-4" />
        </>
      );
    case 'orders':
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </>
      );
    case 'profile':
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
        </>
      );
  }
}

export interface StudentTabBarProps {
  active: StudentTabId;
  onSelect: (tab: StudentTabId, button: HTMLButtonElement) => void;
  onReselectActive?: (button: HTMLButtonElement) => void;
  placement?: 'inline' | 'sticky' | 'fixed';
  coordinateWithPageTransition?: boolean;
}

let lastCommittedTab: StudentTabId | null = null;

export default function StudentTabBar({
  active,
  onSelect,
  onReselectActive,
  placement = 'inline',
  coordinateWithPageTransition = true,
}: StudentTabBarProps) {
  const [displayTab, setDisplayTab] = useState<StudentTabId>(() => lastCommittedTab ?? active);
  const [animDir, setAnimDir] = useState<'none' | 'forward' | 'backward'>(() => {
    if (!lastCommittedTab || lastCommittedTab === active) return 'none';
    return tabIndexOf(active) > tabIndexOf(lastCommittedTab) ? 'forward' : 'backward';
  });

  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      lastCommittedTab = active;
      setDisplayTab(active);
      setAnimDir('none');
      return;
    }

    const fromTab = displayTab;
    if (fromTab === active) {
      lastCommittedTab = active;
      return;
    }

    const nextDir = tabIndexOf(active) > tabIndexOf(fromTab) ? 'forward' : 'backward';
    setAnimDir(nextDir);

    let frame1 = 0;
    let frame2 = 0;
    const startIndicatorMotion = () => {
      frame1 = window.requestAnimationFrame(() => {
        frame2 = window.requestAnimationFrame(() => {
          lastCommittedTab = active;
          setDisplayTab(active);
        });
      });
    };

    const waitForPage = coordinateWithPageTransition && (
      document.documentElement.dataset.navDirection !== undefined
      || document.documentElement.dataset.studentPageAnimating !== undefined
    );
    const timer = waitForPage
      ? window.setTimeout(startIndicatorMotion, 220)
      : 0;
    if (!waitForPage) startIndicatorMotion();

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, [active, coordinateWithPageTransition]);

  const activeIndex = tabIndexOf(displayTab);
  const placementClass =
    placement === 'fixed'
      ? ' student-tabbar--fixed'
      : placement === 'sticky'
        ? ' student-tabbar--sticky'
        : ' student-tabbar--inline';

  return (
    <nav
      className={`student-tabbar${placementClass}`}
      aria-label="学生端导航"
      data-active-index={activeIndex}
      data-anim-dir={animDir}
    >
      <div className="student-tabbar__track" aria-hidden="true">
        <span className="student-tabbar__indicator" />
        <span className="student-tabbar__blob" />
      </div>
      {STUDENT_TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`student-tabbar__item${active === id ? ' is-active' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          onClick={(event) => {
            if (id === active) {
              if (onReselectActive) {
                onReselectActive(event.currentTarget);
              }
              return;
            }
            lastCommittedTab = active;
            onSelect(id, event.currentTarget);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <TabIcon tab={id} />
          </svg>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
