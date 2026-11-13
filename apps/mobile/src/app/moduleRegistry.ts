import type { MobileModule } from './moduleContract';
import { studentModule } from '../modules/student';
import { adminModule } from '../modules/admin';
import { MerchantPlaceholder } from './placeholders';

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
  adminModule,
];