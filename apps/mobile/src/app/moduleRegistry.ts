import type { MobileModule } from './moduleContract';
import { studentModule } from '../modules/student';
import { AdminPlaceholder, MerchantPlaceholder } from './placeholders';

export const mobileModules: MobileModule[] = [
  studentModule,
  {
    id: 'merchant',
    title: '档口',
    subtitle: '接单、制作与核销（待漪x3接入）',
    route: '/merchant',
    status: 'pending',
    Component: MerchantPlaceholder,
  },
  {
    id: 'admin',
    title: '管理员',
    subtitle: '档口与参考规则配置（待公共实现）',
    route: '/admin',
    status: 'pending',
    Component: AdminPlaceholder,
  },
];