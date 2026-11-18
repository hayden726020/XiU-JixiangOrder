import type { StayState } from '../state/stayRuntime';
import type { StudentMode } from '../types';
import {
  STAY_FAILED_TEXT,
  STAY_PAUSED_TEXT,
  STAY_TRIGGERED_TEXT,
} from './stayTexts';

export interface StayView {
  stateAttr: string;
  phaseText: string;
  noticeText: string;
  showNotice: boolean;
}

export function deriveStayView(state: StayState, mode: StudentMode): StayView {
  if (mode === 'sample' || state.phase === 'disabled') {
    return {
      stateAttr: 'disabled',
      phaseText: '',
      noticeText: '',
      showNotice: false,
    };
  }
  if (state.phase === 'paused') {
    return {
      stateAttr: 'paused',
      phaseText: '',
      noticeText: STAY_PAUSED_TEXT,
      showNotice: true,
    };
  }
  if (state.phase === 'triggered') {
    return {
      stateAttr: 'triggered',
      phaseText: '',
      noticeText: STAY_TRIGGERED_TEXT,
      showNotice: true,
    };
  }
  if (state.phase === 'failed') {
    return {
      stateAttr: 'failed',
      phaseText: '',
      noticeText: STAY_FAILED_TEXT,
      showNotice: true,
    };
  }
  return {
    stateAttr: state.phase,
    phaseText: '',
    noticeText: '',
    showNotice: false,
  };
}