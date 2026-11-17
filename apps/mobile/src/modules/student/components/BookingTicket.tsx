import { formatYuan } from '../utils/money';
import chickenPhoto from '../assets/dish-chicken-rice.png';

export default function BookingTicket({ name, shop, quantity, amountFen }: {
  name: string;
  shop: string;
  quantity: number;
  amountFen: number;
}) {
  const hasMatchingPhoto = /鸡肉|鸡腿/.test(name) && !/等 \d+ 道/.test(name);
  return <div className="booking-ticket">
    <span className="booking-ticket__torn" aria-hidden="true" />
    <div className="booking-ticket__polaroid">{hasMatchingPhoto
      ? <img src={chickenPhoto} alt="鸡肉饭展示" />
      : <span className="booking-ticket__placeholder" aria-hidden="true">今日餐食</span>}</div>
    <div className="booking-ticket__details">
      <h3>{name}</h3>
      <p>{shop}</p>
      <span>共 {quantity} 份</span>
    </div>
    <div className="booking-ticket__price">{formatYuan(amountFen)}</div>
    <svg className="booking-ticket__bowl" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 23h32c0 10-7 17-16 17S8 33 8 23ZM13 42h22M15 22c2-5 6-6 10-3 3-5 8-4 10 3M18 13c-3-4 3-5 1-9m8 10c-3-4 3-5 1-9m8 11c-3-4 3-5 1-9" /></svg>
  </div>;
}
