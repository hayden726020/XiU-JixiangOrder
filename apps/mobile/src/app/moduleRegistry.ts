import type { MobileModule } from './moduleContract';
import { studentModule } from '../modules/student';
import { merchantModule } from '../modules/merchant';
import { adminModule } from '../modules/admin';

export const mobileModules: MobileModule[] = [
  studentModule,
  merchantModule,
  adminModule,
];