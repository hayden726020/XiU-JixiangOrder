import type { MobileModule } from '../../app/moduleContract';
import AdminHome from './AdminHome';

export const adminModule: MobileModule = {
  id: 'admin',
  title: '管理员',
  subtitle: '订单查询、营业与食堂配置（S1 只读样例）',
  route: '/admin',
  status: 'ready',
  Component: AdminHome,
};