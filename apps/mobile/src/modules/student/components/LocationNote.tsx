import { useState } from 'react';
import type { PresenceState } from '../state/locationController';
import {
  LOCATION_USAGE_ITEMS,
  LOCATION_USAGE_SUMMARY,
  PRESENCE_CLEAR_LABEL,
  PRESENCE_RETRY_LABEL,
  PRESENCE_TEXT,
} from './locationTexts';

export interface LocationNoteProps {
  state: PresenceState;
  mode: 'sample' | 'real';
  onRetry: () => void;
  onClear: () => void;
}

function statusText(state: PresenceState): string {
  if (state.phase === 'loading') {
    return PRESENCE_TEXT.loading;
  }
  if (state.phase === 'sample') {
    return PRESENCE_TEXT.sample;
  }
  if (state.phase === 'inside') {
    return PRESENCE_TEXT.inside;
  }
  if (state.phase === 'outside') {
    return PRESENCE_TEXT.outside;
  }
  if (state.messageKey === 'cleared') {
    return PRESENCE_TEXT.cleared;
  }
  if (state.reason === 'PERMISSION_DENIED') {
    return PRESENCE_TEXT.denied;
  }
  if (state.reason === 'PERMISSION_RESTRICTED') {
    return PRESENCE_TEXT.restricted;
  }
  if (state.reason === 'CAPABILITY_UNAVAILABLE') {
    return PRESENCE_TEXT.unavailable;
  }
  if (state.phase === 'unknown') {
    return PRESENCE_TEXT.unknown;
  }
  return '';
}

export default function LocationNote({ state, mode, onRetry, onClear }: LocationNoteProps) {
  const [open, setOpen] = useState(false);
  const text = statusText(state);
  const realMode = mode === 'real';

  return (
    <section className="student-location" aria-labelledby="student-location-title">
      <div className="student-location__header">
        <span id="student-location-title" className="student-location__title">
          关于位置信息
        </span>
        {text ? (
          <span className={`student-location__status is-${state.phase}`} role="status" aria-live="polite">
            {text}
          </span>
        ) : null}
      </div>

      <p className="student-location__summary">{LOCATION_USAGE_SUMMARY}</p>

      <button
        type="button"
        className="student-location__toggle"
        aria-expanded={open}
        aria-controls="student-location-body"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="student-location__state">{open ? '收起位置说明' : '展开位置说明'}</span>
      </button>

      {open ? (
        <div id="student-location-body" className="student-location__body">
          <ul className="student-location__list">
            {LOCATION_USAGE_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="student-location__actions">
            <button
              type="button"
              className="student-secondary"
              disabled={!realMode || !state.canRetry}
              onClick={onRetry}
            >
              {PRESENCE_RETRY_LABEL}
            </button>
            <button
              type="button"
              className="student-secondary"
              disabled={!realMode || !state.canClear}
              onClick={onClear}
            >
              {PRESENCE_CLEAR_LABEL}
            </button>
          </div>
          {!realMode ? (
            <p className="student-location__hint">样例模式不获取真实位置，也不产生可清除的位置记录。</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}