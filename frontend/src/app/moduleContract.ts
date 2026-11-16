import type { ComponentType } from 'react';

export type ModuleId = 'student' | 'merchant' | 'admin';

export type ModuleStatus = 'ready' | 'pending';

export interface MobileModule {
  id: ModuleId;
  title: string;
  subtitle: string;
  route: string;
  status: ModuleStatus;
  Component: ComponentType;
}