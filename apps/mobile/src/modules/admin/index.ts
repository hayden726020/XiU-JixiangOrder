import type { MobileModule } from '../../app/moduleContract';
import AdminHome from './AdminHome';

export const adminModule: MobileModule = {
  id: 'admin',
  title: '管理员',
  subtitle: '订单查询与营业/食堂配置只读',
  route: '/admin',
  status: 'ready',
  Component: AdminHome,
};