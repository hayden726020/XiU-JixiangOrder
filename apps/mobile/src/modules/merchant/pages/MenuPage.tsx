import type { MenuDay, SlotDay } from '../data/types';
import { formatClock } from '../state/orderView';
import { formatYuan } from '../utils/money';

interface MenuPageProps {
  dates: ReadonlyArray<string>;
  date: string;
  onDateChange: (date: string) => void;
  menu: MenuDay | null;
  slots: SlotDay | null;
  onBack: () => void;
}

export default function MenuPage({ dates, date, onDateChange, menu, slots, onBack }: MenuPageProps) {
  return (
    <div className="merchant-view">
      <button type="button" className="back-link" onClick={onBack}>← 返回订单列表</button>
      <header className="merchant-view__header">
        <div>
          <h2>菜单与库存</h2>
          <p className="lead">只读样例。档口读取接口在契约中缺失，第 2—3 天接入服务后才可修改。</p>
        </div>
      </header>

      <div className="date-switch">
        {dates.map((option) => (
          <button
            key={option}
            type="button"
            className={option === date ? 'date-switch__button date-switch__button--active' : 'date-switch__button'}
            onClick={() => onDateChange(option)}
          >
            {option === '2026-11-13' ? `今天 ${option}` : `明天 ${option}`}
          </button>
        ))}
      </div>

      {!menu || !slots ? (
        <p className="merchant-empty">这一天没有样例数据。</p>
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
              第 2—3 天接入服务后可修改
            </button>
          </section>

          <section className="detail-block">
            <h3>时段（接单名额）</h3>
            <ul className="slot-list">
              {slots.slots.map((slot) => (
                <li key={slot.slotId} className={slot.full ? 'slot-item slot-item--full' : 'slot-item'}>
                  <span className="slot-item__time">
                    {formatClock(slot.slotStart)}—{formatClock(slot.slotEnd)}
                  </span>
                  <span>名额 {slot.capacity}</span>
                  <span>已占 {slot.occupied}</span>
                  <span>剩余 {slot.remaining}{slot.full ? '（已满）' : ''}</span>
                </li>
              ))}
            </ul>
            <p className="hint">“接单名额”指订单笔数上限，不是食堂座位数；页面不出现“座位/空位”。</p>
          </section>
        </>
      )}
    </div>
  );
}