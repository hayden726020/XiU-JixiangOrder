export type StudentTab = 'home' | 'order' | 'orders' | 'profile';

interface StudentTabBarProps {
  active: StudentTab;
  onGoHome: () => void;
  onGoOrder: () => void;
  onOpenOrders: () => void;
  onOpenProfile: () => void;
}

const TABS: Array<{ id: StudentTab; label: string }> = [
  { id: 'home', label: '首页' },
  { id: 'order', label: '点餐' },
  { id: 'orders', label: '订单' },
  { id: 'profile', label: '我的' },
];

function TabIcon({ tab }: { tab: StudentTab }) {
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

export default function StudentTabBar({
  active,
  onGoHome,
  onGoOrder,
  onOpenOrders,
  onOpenProfile,
}: StudentTabBarProps) {
  const actions: Record<StudentTab, () => void> = {
    home: onGoHome,
    order: onGoOrder,
    orders: onOpenOrders,
    profile: onOpenProfile,
  };

  return (
    <nav className="student-tabbar" aria-label="学生端底部导航">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`student-tabbar__item${active === id ? ' is-active' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          onClick={actions[id]}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <TabIcon tab={id} />
          </svg>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
