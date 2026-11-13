import type { MobileModule } from '../../app/moduleContract';
import StudentHome from './StudentHome';

export const studentModule: MobileModule = {
  id: 'student',
  title: '学生',
  subtitle: '选餐、预约、下单与取餐（S5 确认下单与样例订单）',
  route: '/student',
  status: 'ready',
  Component: StudentHome,
};