import type { StudentMode } from '../types';

export const STUDENT_MODE_OVERRIDE_KEY = 'xiu.student.modeOverride.v1';

export function readStudentModeOverride(): StudentMode | null {
  try {
    const value = window.localStorage.getItem(STUDENT_MODE_OVERRIDE_KEY);
    return value === 'real' || value === 'sample' ? value : null;
  } catch {
    return null;
  }
}

export function writeStudentModeOverride(mode: StudentMode): void {
  try {
    window.localStorage.setItem(STUDENT_MODE_OVERRIDE_KEY, mode);
  } catch {
    return;
  }
}

export function resolveStudentMode(): StudentMode {
  return (
    readStudentModeOverride() ??
    (import.meta.env.VITE_STUDENT_MODE === 'real' ? 'real' : 'sample')
  );
}
