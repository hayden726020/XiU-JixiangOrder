import { useEffect, useMemo, useState } from 'react';
import type { MerchantOrder } from '../data/types';
import { buildPrepSummary } from '../state/prepSummary';

interface PrepSummaryProps {
  date: string;
  today: string;
  dates: ReadonlyArray<string>;
  orders: MerchantOrder[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

function dayLabel(date: string, today: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  const short = `${Number(parts[1])}月${Number(parts[2])}日`;
  if (date === today) return `今天 ${short}`;
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  if (date === next.toISOString().slice(0, 10)) return `明天 ${short}`;
  return short;
}

export default function PrepSummary({
  date,
  today,
  dates,
  orders,
  loading,
  error,
  truncated,
  onRefresh,
  onClose,
}: PrepSummaryProps) {
  const [selectedDate, setSelectedDate] = useState(date);

  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  const summary = useMemo(
    () => buildPrepSummary(orders, selectedDate),
    [orders, selectedDate],
  );
  const dateLabel = dayLabel(selectedDate, today);
  const dateOptions = dates.length > 0 ? dates : [selectedDate];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="prep-summary" role="presentation">
      <button
        type="button"
        className="prep-summary__mask"
        aria-label="关闭备餐汇总"
        onClick={onClose}
      />
      <aside
        className="prep-summary__drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-summary-title"
        data-prep-summary
      >
        <header className="prep-summary__head">
          <div>
            <h3 id="prep-summary-title">分时段备餐汇总</h3>
            <p>{dateLabel} · 按预约时段与菜品汇总，取消订单不计入备餐。</p>
          </div>
          <button type="button" className="prep-summary__close" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="prep-summary__dates" role="tablist" aria-label="备餐日期">
          {dateOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={option === selectedDate}
              className={option === selectedDate
                ? 'prep-summary__date is-active'
                : 'prep-summary__date'}
              onClick={() => setSelectedDate(option)}
            >
              {dayLabel(option, today)}
            </button>
          ))}
        </div>

        <div className="prep-summary__toolbar">
          <span>
            {loading
              ? '正在读取订单…'
              : `${summary.orderCount} 笔有效订单 · 需备餐 ${summary.prepTotal} 份（有效总量 ${summary.total} 份）`}
          </span>
          <button
            type="button"
            className="merchant-link-button"
            onClick={onRefresh}
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {loading ? '刷新中…' : '刷新汇总'}
          </button>
        </div>

        {error && (
          <p className="action-feedback action-feedback--error" role="alert">
            备餐汇总读取失败：{error}
          </p>
        )}
        {!error && truncated && (
          <p className="prep-summary__hint">
            当前按最多 500 笔订单汇总；订单量更大时请以后端汇总接口为准。
          </p>
        )}

        {!loading && !error && summary.groups.length === 0 ? (
          <p className="merchant-empty">这一天还没有可备餐的订单。</p>
        ) : (
          <div className="prep-summary__body">
            <div className="prep-summary__totals" aria-label="当日备餐合计">
              <span><i className="is-pending" />待制作 <b>{summary.pending}</b> 份</span>
              <span><i className="is-preparing" />制作中 <b>{summary.preparing}</b> 份</span>
              <span><i className="is-ready" />已备好 <b>{summary.ready}</b> 份</span>
              <span><i className="is-done" />已取餐 <b>{summary.completed}</b> 份</span>
            </div>

            {summary.groups.map((group) => (
              <section className="prep-slot" key={group.slotId} aria-label={`${group.startLabel} 至 ${group.endLabel}`}>
                <header className="prep-slot__head">
                  <strong>{group.startLabel}—{group.endLabel}</strong>
                  <span>
                    {group.orderCount} 笔订单 · 需备餐 {group.prepTotal} 份（有效总量 {group.total} 份）
                  </span>
                </header>
                <div className="prep-slot__stats">
                  <span>待制作 <b>{group.pending}</b></span>
                  <span>制作中 <b>{group.preparing}</b></span>
                  <span>已备好 <b>{group.ready}</b></span>
                  <span>已取餐 <b>{group.completed}</b></span>
                </div>
                <table className="prep-slot__table">
                  <thead>
                    <tr>
                      <th scope="col">菜品</th>
                      <th scope="col">待制作</th>
                      <th scope="col">制作中</th>
                      <th scope="col">已备好</th>
                      <th scope="col">已取餐</th>
                      <th scope="col">总量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.dishes.map((dish) => (
                      <tr key={dish.dishId}>
                        <th scope="row">{dish.name}</th>
                        <td className={dish.pending > 0 ? 'is-pending' : 'is-zero'}>{dish.pending}</td>
                        <td className={dish.preparing > 0 ? 'is-preparing' : 'is-zero'}>{dish.preparing}</td>
                        <td className={dish.ready > 0 ? 'is-ready' : 'is-zero'}>{dish.ready}</td>
                        <td className={dish.completed > 0 ? 'is-done' : 'is-zero'}>{dish.completed}</td>
                        <td><b>{dish.total}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        {summary.cancelledCount > 0 && (
          <p className="prep-summary__footnote">
            已排除 {summary.cancelledCount} 笔已取消订单；已取餐订单单独列出，不计入仍需备餐的数量。
          </p>
        )}
      </aside>
    </div>
  );
}