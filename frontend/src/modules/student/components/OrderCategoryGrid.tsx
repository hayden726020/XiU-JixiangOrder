import type { ReactNode } from 'react';
import type { OrderCategoryId } from '../utils/orderVisuals';

export interface OrderCategoryItem {
  id: OrderCategoryId;
  label: string;
  bgColor: string;
  icon: ReactNode;
}

const STROKE = '#1a202c';

const CATEGORY_ITEMS: OrderCategoryItem[] = [
  {
    id: 'stir-fry',
    label: '家常小炒',
    bgColor: '#fcf2da',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M11 21c0-5 4-8.5 9-8.5s9 3.5 9 8.5"
          fill="#ffffff"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M23 14.5 31 8m-6.5 7.2L32.5 10"
          stroke="#7c4a1d"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M9 21h22a11 11 0 0 1-22 0Z"
          fill="#f4e6b8"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M15 32h10" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'noodles',
    label: '面食粉类',
    bgColor: '#fde8ea',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M13 11.5h18.5M14 14.2h17.5" stroke="#8d5524" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M15.5 14v8m3.5-8v8m3.5-8v8"
          stroke="#f6b93b"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M9.5 21.5h21a10.5 10.5 0 0 1-21 0Z"
          fill="#fbbf24"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M13 24.5h14" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        <path d="M15 32h10" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'rice-set',
    label: '米饭套餐',
    bgColor: '#e7f3e8',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect
          x="8.5"
          y="14"
          width="23"
          height="14"
          rx="6"
          fill="#ffffff"
          stroke={STROKE}
          strokeWidth="1.7"
        />
        <circle cx="15" cy="19.5" r="4" fill="#ffffff" stroke={STROKE} strokeWidth="1.3" />
        <circle cx="15" cy="19.5" r="2" fill="#f59e0b" />
        <path
          d="M21 17.5c1.5-2 5.5-2 7 0 1.2 1.7.5 4.8-2.2 5.2-2.8.4-5.7-1.6-4.8-5.2Z"
          fill="#ea6a32"
          stroke={STROKE}
          strokeWidth="1.4"
        />
        <path d="M11 26.5c2 2.2 16 2.2 18 0" stroke="#74b47e" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'mala',
    label: '麻辣香锅',
    bgColor: '#fdebd8',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M14.5 12c-.5-1.5.5-2.5 0-4M20 11.5c-.5-1.5.5-2.5 0-4M25.5 12c-.5-1.5.5-2.5 0-4"
          stroke="#ef4444"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M12 18.5c2-3 5.5-3.5 8-1.5 2.5-2 6-1.5 8 1.5" fill="#dc2626" />
        <circle cx="16.5" cy="17.5" r="1.8" fill="#fbbf24" />
        <circle cx="23.5" cy="17.5" r="1.8" fill="#22c55e" />
        <path
          d="M7.5 19.5h2.5m20 0h2.5"
          stroke={STROKE}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M10 19.5h20a10 10 0 0 1-20 0Z"
          fill="#2d3748"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M14 29.5 12.5 32M26 29.5l1.5 2.5" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M18.5 31.5c0-1.5 1.5-2.5 1.5-2.5s1.5 1 1.5 2.5a1.5 1.5 0 0 1-3 0Z" fill="#f97316" />
      </svg>
    ),
  },
  {
    id: 'fast-food',
    label: '快餐小吃',
    bgColor: '#e6f2fc',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M10.5 18.5c0-5 4.2-8.5 9.5-8.5s9.5 3.5 9.5 8.5H10.5Z"
          fill="#f6ad3c"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="14" r=".9" fill="#fff7ed" />
        <circle cx="20.5" cy="12.8" r=".9" fill="#fff7ed" />
        <circle cx="24" cy="15" r=".9" fill="#fff7ed" />
        <path
          d="M9.5 20.5c1.5-1.3 3.2 1.3 5 0s3.2 1.3 5 0 3.2 1.3 5 0 3.2 1.3 5.5 0"
          stroke="#48bb78"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <rect x="10" y="22.5" width="20" height="4" rx="2" fill="#8b4513" stroke={STROKE} strokeWidth="1.5" />
        <path
          d="M11 26.8h18v1.7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 11 28.5v-1.7Z"
          fill="#f6ad3c"
          stroke={STROKE}
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
  {
    id: 'light-meal',
    label: '轻食简餐',
    bgColor: '#e4f5ea',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M11.5 20.5c-.5-4.5 2.5-7 5-5.5 1.5-3.2 5.5-3.2 7 0 2.5-1.5 5.5 1 5 5.5"
          fill="#86efac"
          stroke={STROKE}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="15.5" cy="17.5" r="2.1" fill="#ef4444" stroke={STROKE} strokeWidth="1.2" />
        <circle cx="24" cy="18" r="2" fill="#fbbf24" stroke={STROKE} strokeWidth="1.2" />
        <path
          d="M9.5 20.5h21a10.5 10.5 0 0 1-21 0Z"
          fill="#ffffff"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M15 31.5h10" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'drinks',
    label: '饮品甜点',
    bgColor: '#efeafd',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M22.5 8 20 15" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M13 15h14" stroke={STROKE} strokeWidth="2.1" strokeLinecap="round" />
        <path
          d="M14 15.5h12l-1.5 15a1.5 1.5 0 0 1-1.5 1.3h-6a1.5 1.5 0 0 1-1.5-1.3l-1.5-15Z"
          fill="#e6c49f"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M15 21h10" stroke="#ffffff" strokeWidth="2.4" opacity="0.55" />
        <circle cx="18" cy="28" r="1.2" fill="#4a3728" />
        <circle cx="22" cy="28" r="1.2" fill="#4a3728" />
        <circle cx="20" cy="25.5" r="1.1" fill="#4a3728" />
      </svg>
    ),
  },
  {
    id: 'all',
    label: '更多分类',
    bgColor: '#edf0f5',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="11" y="11" width="7.2" height="7.2" rx="1.8" stroke={STROKE} strokeWidth="1.9" />
        <rect x="21.8" y="11" width="7.2" height="7.2" rx="1.8" stroke={STROKE} strokeWidth="1.9" />
        <rect x="11" y="21.8" width="7.2" height="7.2" rx="1.8" stroke={STROKE} strokeWidth="1.9" />
        <rect x="21.8" y="21.8" width="7.2" height="7.2" rx="1.8" stroke={STROKE} strokeWidth="1.9" />
      </svg>
    ),
  },
];

export interface OrderCategoryGridProps {
  selectedCategory: OrderCategoryId;
  onSelectCategory: (category: OrderCategoryId) => void;
}

export default function OrderCategoryGrid({
  selectedCategory,
  onSelectCategory,
}: OrderCategoryGridProps) {
  return (
    <div className="order-cat-grid" role="group" aria-label="美食分类">
      {CATEGORY_ITEMS.map((item) => {
        const isSelected = item.id !== 'all' && selectedCategory === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`order-cat-item${isSelected ? ' is-selected' : ''}`}
            aria-pressed={item.id === 'all' ? selectedCategory === 'all' : isSelected}
            onClick={() => {
              if (item.id === 'all') {
                onSelectCategory('all');
              } else {
                onSelectCategory(selectedCategory === item.id ? 'all' : item.id);
              }
            }}
          >
            <span
              className="order-cat-item__circle"
              style={{ backgroundColor: item.bgColor }}
            >
              {item.icon}
            </span>
            <span className="order-cat-item__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
