import type { StudentMode } from '../types';

export function resolveStudentMode(): StudentMode {
  return import.meta.env.VITE_STUDENT_MODE === 'real' ? 'real' : 'sample';
}