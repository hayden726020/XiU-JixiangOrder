import './student-bottom-nav.css';

export type StudentNavTab = 'home' | 'order' | 'orders' | 'mine';

export interface StudentBottomNavProps {
  activeTab: StudentNavTab;
  onSelectHome?: () => void;
  onSelectOrder?: () => void;
  onSelectOrders?: () => void;
  onSelectMine?: () => void;
  position?: 'sticky' | 'static';
}

function NavIcon({ name }: { name: StudentNavTab }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10H3zM9 21v-7h6v7" />,
    order: (
      <>
        <path d="M3 12h18a9 9 0 0 1-18 0ZM5 21h14" />
        <path d="M9 8c0-2 2-2 2-4m4 5c0-2 2-2 2-4" />
      </>
    ),
    orders: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    mine: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
      </>
    ),
  }[name];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export default function StudentBottomNav({
  activeTab,
  onSelectHome,
  onSelectOrder,
  onSelectOrders,
  onSelectMine,
  position = 'sticky',
}: StudentBottomNavProps) {
  const tabs: { id: StudentNavTab; label: string; onClick?: () => void }[] = [
    { id: 'home', label: '首页', onClick: onSelectHome },
    { id: 'order', label: '点餐', onClick: onSelectOrder },
    { id: 'orders', label: '订单', onClick: onSelectOrders },
    { id: 'mine', label: '我的', onClick: onSelectMine },
  ];

  return (
    <nav
      className={`student-home__nav${position === 'static' ? ' student-home__nav--static' : ''}`}
      aria-label="学生端导航"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`student-home__nav-btn${active ? ' is-active-tab' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={tab.onClick}
          >
            <span className="nav-tab-pill">
              <NavIcon name={tab.id} />
              <span>{tab.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
