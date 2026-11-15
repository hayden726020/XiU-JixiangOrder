import type { MobileModule } from '../../app/moduleContract';
import MerchantHome from './MerchantHome';

export const merchantModule: MobileModule = {
  id: 'merchant',
  title: '档口',
  subtitle: '接单、制作与核销（样例骨架）',
  route: '/merchant',
  status: 'ready',
  Component: MerchantHome,
};