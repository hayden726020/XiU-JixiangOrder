import type { MenuDay, SlotDay } from '../data/types';
import { menuDateOptions } from '../state/menuView';
import { formatClock } from '../state/orderView';
import { formatYuan } from '../utils/money';

interface MenuPageProps {
  dates: ReadonlyArray<string>;
  date: string;
  today: string;
  isSample: boolean;
  loading: boolean;
  error: string | null;
  onDateChange: (date: string) => void;
  menu: MenuDay | null;
  slots: SlotDay | null;
  onBack: () => void;
}

export default function MenuPage({
  dates,
  date,
  today,
  isSample,
  loading,
  error,
  onDateChange,
  menu,
  slots,
  onBack,
}: MenuPageProps) {
  const dateOptions = menuDateOptions(dates, today);

  return (
    <div className="merchant-view">
      <button type="button" className="back-link" onClick={onBack}>← 返回订单列表</button>
      <header className="merchant-view__header">
        <div>
          <h2>
            菜单与库存
            <span className="merchant-readonly-tag">
              {isSample ? '只读样例' : '只读 · 演示服务'}
            </span>
          </h2>
          <p className="lead">
            {isSample
              ? '价格与可售数量来自样例数据源，页面不写死；档口修改接口尚未接入。'
              : '价格与可售数量来自 GET /menu；当前只读，档口修改接口尚未接入。'}
          </p>
        </div>
      </header>

      <div className="date-switch">
        {dateOptions.map((option) => (
          <button
            key={option.date}
            type="button"
            className={option.date === date ? 'date-switch__button date-switch__button--active' : 'date-switch__button'}
            onClick={() => onDateChange(option.date)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="merchant-empty">正在读取菜单与时段…</p>
      ) : error ? (
        <p className="merchant-empty">菜单读取失败：{error}</p>
      ) : !menu || !slots ? (
        <p className="merchant-empty">这一天没有数据。</p>
      ) : (
        <>
          <section className="detail-block">
            <h3>菜品（{menu.dishes.length}）</h3>
            <ul className="menu-list">
              {menu.dishes.map((dish) => (
                <li key={dish.dishId} className={dish.onSale ? 'menu-item' : 'menu-item menu-item--off'}>
                  <span className="menu-item__name">
                    {dish.name}
                    {!dish.onSale && <span className="merchant-flag">已停售</span>}
                  </span>
                  <span className="menu-item__price">{formatYuan(dish.unitPriceFen)}</span>
                  <span className="menu-item__qty">可售 {dish.availableQuantity}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="action-button action-button--secondary" disabled>
              接入档口修改接口后可修改
            </button>
          </section>

          <section className="detail-block">
            <h3>时段（接单名额）</h3>
            <ul className="slot-list">
              {slots.slots.map((slot) => {
                const closed = !slot.enabled;
                const tone = slot.full || closed ? 'slot-item slot-item--full' : 'slot-item';
                return (
                  <li key={slot.slotId} className={tone}>
                    <span className="slot-item__time">
                      {formatClock(slot.slotStart)}—{formatClock(slot.slotEnd)}
                    </span>
                    <span>名额 {slot.capacity}</span>
                    <span>已占 {slot.occupied}</span>
                    <span>
                      剩余 {slot.remaining}
                      {slot.full ? '（已满）' : closed ? '（已关闭）' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="hint">
              “接单名额”指订单笔数上限，不是食堂座位数；“已关闭”由服务端按时间、名额或启停状态返回。
            </p>
          </section>
        </>
      )}
    </div>
  );
}