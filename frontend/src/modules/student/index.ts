import type { MobileModule } from '../../app/moduleContract';
import StudentHome from './StudentHome';

export const studentModule: MobileModule = {
  id: 'student',
  title: '学生',
  subtitle: '选餐、预约、下单与取餐（S6 订单详情初版）',
  route: '/student',
  status: 'ready',
  Component: StudentHome,
};