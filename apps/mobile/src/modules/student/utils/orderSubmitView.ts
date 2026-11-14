import type { SourceError } from '../types';
import { ACTION_LABELS, resolveSubmitSemantics, type ErrorAction } from './errorSemantics';
import { dishShortageWithNames } from './submitTexts';

export type SubmitErrorAction = Extract<
  ErrorAction,
  'login' | 'reconfirm' | 'retry' | 'back-to-slot' | 'back-to-menu'
>;

export interface SubmitErrorView {
  code: string;
  message: string;
  action: SubmitErrorAction;
  actionLabel: string;
}

export function toSubmitErrorView(error: SourceError | null): SubmitErrorView | null {
  if (!error) {
    return null;
  }

  const semantics = resolveSubmitSemantics(error);
  const action: SubmitErrorAction = semantics.action === 'reload' ? 'retry' : semantics.action;
  const dishNames = Array.isArray(error.dishNames) ? error.dishNames : [];
  const message =
    error.code === 'OUT_OF_STOCK' && dishNames.length > 0
      ? dishShortageWithNames(dishNames)
      : semantics.message;

  return {
    code: error.code,
    message,
    action,
    actionLabel: ACTION_LABELS[action],
  };
}