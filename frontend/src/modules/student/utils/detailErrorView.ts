import type { SourceError } from '../types';
import {
  ACTION_LABELS,
  resolveDetailSemantics,
  type ErrorAction,
} from './errorSemantics';

export type DetailErrorAction = Extract<ErrorAction, 'login' | 'back-to-menu' | 'reload'>;

export interface DetailErrorView {
  code: string;
  message: string;
  action: DetailErrorAction;
  actionLabel: string;
}

export function toDetailErrorView(error: SourceError | null): DetailErrorView | null {
  if (!error) {
    return null;
  }
  const semantics = resolveDetailSemantics(error);
  const action: DetailErrorAction =
    semantics.action === 'login' || semantics.action === 'back-to-menu'
      ? semantics.action
      : 'reload';
  return {
    code: error.code,
    message: semantics.message,
    action,
    actionLabel: ACTION_LABELS[action],
  };
}