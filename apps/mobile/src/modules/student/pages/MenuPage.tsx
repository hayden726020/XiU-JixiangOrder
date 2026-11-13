import { useEffect, useState } from 'react';
import { DATES } from '../data/sampleData';
import type { MenuResponse, StudentSource } from '../types';
import { isApiError } from '../types';
import { formatYuan } from '../utils/money';
import DemoModeNotice from '../components/DemoModeNotice';
import SampleBanner from '../components/SampleBanner';

type LoadStatus = 'loading' | 'ready' | 'error';

const DAY_LABELS = ['今天', '明天'];

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}-${day}`;
}

export interface MenuPageProps {
  source: StudentSource;
}

export default function MenuPage({ source }: MenuPageProps) {
  const [date, setDate] = useState<string>(DATES[0]);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (!cancelled) {
          setMenu(data);
          setStatus('ready');
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setMenu(null);
          setStatus('error');
          setErrorText(isApiError(error) ? error.message : '菜单读取失败，请重试');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, date, reloadToken]);

  return (
    <section className="student-page" aria-labelledby="student-menu-title">
      <SampleBanner />

      <header className="student-page__head">
        <p className="student-kicker">S1 · 样例菜单骨架（数量选择下一步开放）</p>
        <h2 id="student-menu-title">学生点餐</h2>
        <p className="student-page__lead">当前只读取模块内的样例菜单，不连接任何真实服务。</p>
      </header>

      <div className="student-date-switch" role="group" aria-label="选择菜单日期">
        {DATES.map((item, index) => (
          <button
            key={item}
            type="button"
            className={`student-date-switch__item${date === item ? ' is-active' : ''}`}
            aria-pressed={date === item}
            onClick={() => setDate(item)}
          >
            {DAY_LABELS[index]} {formatMonthDay(item)}
          </button>
        ))}
      </div>

      {status === 'loading' ? <p className="student-loading">正在读取样例菜单…</p> : null}

      {status === 'error' ? (
        <div className="student-error" role="alert">
          <p>{errorText}</p>
          <button type="button" className="student-secondary" onClick={() => setReloadToken((value) => value + 1)}>
            重新读取
          </button>
        </div>
      ) : null}

      {status === 'ready' && menu && menu.dishes.length === 0 ? (
        <p className="student-loading">暂无菜单信息，请稍后重试</p>
      ) : null}

      {status === 'ready' && menu && menu.dishes.length > 0 ? (
        <ul className="student-dish-list" aria-label={`${formatMonthDay(menu.date)} 样例菜品`}>
          {menu.dishes.map((dish) => (
            <li key={dish.dishId} className={`student-dish${dish.onSale ? '' : ' is-off'}`}>
              <div className="student-dish__body">
                <p className="student-dish__name">{dish.name}</p>
                <p className="student-dish__meta">
                  {dish.onSale ? `可售 ${dish.availableQuantity} 份` : '今日已停售'}
                </p>
              </div>
              <span className="student-dish__price">{formatYuan(dish.unitPriceFen)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="student-summary">
        <p className="student-summary__main">尚未选择菜品</p>
        <p className="student-summary__note">金额以服务端返回为准</p>
        <button type="button" className="student-primary" disabled>
          下一步：选择时段
        </button>
        <p className="student-summary__hint">数量选择在 S2 接入；当前菜单仅供查看。</p>
      </footer>

      <DemoModeNotice />
    </section>
  );
}