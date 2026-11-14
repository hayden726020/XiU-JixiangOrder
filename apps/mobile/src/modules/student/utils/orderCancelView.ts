import type { StudentMode, StudentOrder } from '../types';
import {
  CANCEL_APPLY_NOTE,
  CANCEL_APPROVED_TEXT,
  CANCEL_DECISION_MISSING,
  CANCEL_INVALID_TEXT,
  CANCEL_PENDING_TEXT,
  CANCEL_READY_PENDING_TEXT,
  CANCEL_REJECTED_TEXT,
  CANCEL_SAMPLE_TEXT,
} from './cancelTexts';

export type CancelAreaKind =
  | 'none'
  | 'new'
  | 'apply'
  | 'pending'
  | 'rejected'
  | 'approved'
  | 'sample'
  | 'invalid';

export interface CancelAreaView {
  kind: CancelAreaKind;
  actionLabel: string | null;
  actionEnabled: boolean;
  reasonRequired: boolean;
  noticeText: string;
  decisionReason: string;
  resultText: string;
}

export interface DeriveCancelAreaOptions {
  mode?: StudentMode;
}

function empty(kind: CancelAreaKind): CancelAreaView {
  return {
    kind,
    actionLabel: null,
    actionEnabled: false,
    reasonRequired: false,
    noticeText: '',
    decisionReason: '',
    resultText: '',
  };
}

function decisionOf(order: StudentOrder): string {
  const value = order.cancelRequest?.decisionReason;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function isInvalidCombination(order: StudentOrder): boolean {
  const request = order.cancelRequest?.status ?? 'NONE';
  if (order.status === 'NEW' && request === 'PENDING') {
    return true;
  }
  if (request === 'PENDING' && (order.status === 'COMPLETED' || order.status === 'CANCELLED')) {
    return true;
  }
  if (request === 'APPROVED' && order.status !== 'CANCELLED') {
    return true;
  }
  if (request === 'REJECTED' && order.status === 'CANCELLED') {
    return true;
  }
  return false;
}

export function deriveCancelAreaView(
  order: StudentOrder,
  { mode = 'sample' }: DeriveCancelAreaOptions = {},
): CancelAreaView {
  if (mode === 'sample') {
    return { ...empty('sample'), noticeText: CANCEL_SAMPLE_TEXT };
  }

  if (isInvalidCombination(order)) {
    return { ...empty('invalid'), noticeText: CANCEL_INVALID_TEXT };
  }

  const request = order.cancelRequest?.status ?? 'NONE';
  const decisionReason = decisionOf(order);

  if (order.status === 'CANCELLED') {
    if (request === 'APPROVED') {
      return {
        ...empty('approved'),
        noticeText: CANCEL_APPROVED_TEXT,
        decisionReason,
        resultText: CANCEL_APPROVED_TEXT,
      };
    }
    return empty('none');
  }

  if (order.status === 'COMPLETED') {
    return empty('none');
  }

  if (request === 'PENDING') {
    return {
      ...empty('pending'),
      noticeText: order.status === 'READY' ? CANCEL_READY_PENDING_TEXT : CANCEL_PENDING_TEXT,
    };
  }

  if (order.status === 'NEW') {
    return {
      ...empty('new'),
      actionLabel: '取消订单',
      actionEnabled: true,
    };
  }

  if (order.status === 'ACCEPTED' || order.status === 'PREPARING' || order.status === 'READY') {
    if (request === 'REJECTED') {
      return {
        ...empty('rejected'),
        actionLabel: '再次申请',
        actionEnabled: true,
        reasonRequired: true,
        noticeText: `${CANCEL_REJECTED_TEXT}${
          decisionReason === '' ? ` ${CANCEL_DECISION_MISSING}` : ''
        }`,
        decisionReason,
      };
    }
    return {
      ...empty('apply'),
      actionLabel: '申请取消',
      actionEnabled: true,
      reasonRequired: true,
      noticeText: CANCEL_APPLY_NOTE,
    };
  }

  return empty('none');
}