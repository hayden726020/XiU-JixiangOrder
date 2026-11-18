import type { StudentOrder } from '../types';
import { formatYuan } from '../utils/money';
import { toOrderStatusView } from '../utils/orderStatusView';
import type { StudentMode } from '../types';
import ricePhoto from '../assets/fried-rice.png';
import noodlePhoto from '../assets/login-food-noodle.jpg';
import chickenPhoto from '../assets/dish-chicken-rice.png';
import OrderListIcon from './OrderListIcons';

function photoFor(order: StudentOrder): string {
  const name = order.items[0]?.name ?? '';
  if (/炒饭/.test(name)) return ricePhoto;
  if (/面|粉/.test(name)) return noodlePhoto;
  if (/鸡|肉饭/.test(name)) return chickenPhoto;
  return ricePhoto;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '时间待确认';
  const day = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const when = day === today ? '今天' : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`;
  const time = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${when} ${time}`;
}

export default function OrderTicketCard({ order, mode, onOpenOrder, onAskMerchant }: {
  order: StudentOrder;
  mode: StudentMode;
  onOpenOrder: (id: string) => void;
  onAskMerchant: (kind: 'remind' | 'contact', order: StudentOrder) => void;
}) {
  const view = toOrderStatusView(order, { mode });
  const ready = order.status === 'READY';
  const preparing = order.status === 'PREPARING' || order.status === 'ACCEPTED';
  const pending = order.status === 'NEW';
  const tone = ready ? 'ready' : preparing ? 'preparing' : pending ? 'pending' : 'closed';
  const statusIcon = ready ? 'check' : preparing ? 'cooking' : pending ? 'clock' : 'checkSquare';
  const firstDish = order.items[0];
  const code = ready && order.pickupCode ? order.pickupCode : null;
  const shopName = order.merchantName?.trim() || '食堂档口';

  return <article className={`order-ticket order-ticket--${tone}`}>
    <div className="order-ticket__top">
      <span className="order-ticket__number"><OrderListIcon name="clipboard" size={16} />订单号 <strong>{order.id}</strong></span>
      <span>下单时间：{dateLabel(order.createdAt)}</span>
    </div>
    <div className="order-ticket__body">
      <img className="order-ticket__photo" src={photoFor(order)} alt="" loading="lazy" />
      <div className="order-ticket__details">
        <h2>{shopName}</h2>
        <p className="order-ticket__dish">{firstDish ? `${firstDish.name} × ${firstDish.quantity}` : '餐品待确认'}{order.items.length > 1 ? ` 等 ${order.items.length} 项` : ''}</p>
        <p className="order-ticket__meta"><OrderListIcon name="utensils" size={15} />取餐时间：{dateLabel(order.slotStart)} – {dateLabel(order.slotEnd).split(' ').at(-1)}</p>
        <p className="order-ticket__meta"><OrderListIcon name="pin" size={15} />{shopName.includes('食堂') ? shopName.split('·')[0] : '食堂'} · {view.diningModeText}</p>
        {order.cancelRequest.status === 'PENDING' ? <p className="order-ticket__cancel">取消申请处理中</p> : null}
      </div>
      <div className="order-ticket__aside">
        <span className={`order-ticket__status order-ticket__status--${tone}`}><OrderListIcon name={statusIcon} size={19} />{ready ? '待取餐' : view.statusLabel}</span>
        {code ? <><span className="order-ticket__code-label">取餐码</span><strong className="order-ticket__code">{code}</strong></> : null}
        <strong className="order-ticket__price">{formatYuan(order.totalFen)}</strong>
      </div>
    </div>
    <div className="order-ticket__actions">
      <button type="button" className="order-ticket__detail" onClick={() => onOpenOrder(order.id)}>订单详情</button>
      {ready && code ? <button type="button" className="order-ticket__primary" onClick={() => onOpenOrder(order.id)}><OrderListIcon name="qr" size={19} />查看取餐码</button>
        : preparing ? <button type="button" className="order-ticket__primary" onClick={() => onAskMerchant('remind', order)}><OrderListIcon name="bell" size={19} />催单</button>
        : pending ? <button type="button" className="order-ticket__primary" onClick={() => onAskMerchant('contact', order)}><OrderListIcon name="chat" size={19} />联系商家</button>
        : <button type="button" className="order-ticket__primary" onClick={() => onOpenOrder(order.id)}>查看订单</button>}
    </div>
  </article>;
}
