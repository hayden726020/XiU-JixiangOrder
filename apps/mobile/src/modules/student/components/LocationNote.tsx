import { useState } from 'react';
import type { PresenceView } from '../utils/presenceView';
import type { StayView } from '../utils/stayView';
import {
  LOCATION_NO_PROMISE_TEXT,
  LOCATION_SAMPLE_TEXT,
  LOCATION_USAGE_SUMMARY,
  PRESENCE_CLEAR_LABEL,
  PRESENCE_RETRY_LABEL,
  PRESENCE_RETRY_SYNC_LABEL,
  locationUsageItems,
} from './locationTexts';

export interface LocationNoteProps {
  view: PresenceView;
  mode: 'sample' | 'real';
  onRetry: () => void;
  onRetrySync: () => void;
  onClear: () => void;
  stay?: StayView;
}

export default function LocationNote({
  view,
  mode,
  onRetry,
  onRetrySync,
  onClear,
  stay,
}: LocationNoteProps) {
  const [open, setOpen] = useState(false);
  const realMode = mode === 'real';
  const hints = [view.hintText, view.timingText, view.demoText, view.syncText, view.clearText].filter(
    (text) => text !== '',
  );

  return (
    <section className="student-location" aria-labelledby="student-location-title">
      <div className="student-location__header">
        <span id="student-location-title" className="student-location__title">
          关于位置信息
        </span>
        {view.statusText ? (
          <span
            className={`student-location__status is-${view.phase}`}
            role="status"
            aria-live="polite"
          >
            {view.statusText}
          </span>
        ) : null}
      </div>

      <p className="student-location__summary">{LOCATION_USAGE_SUMMARY}</p>

      {stay ? (
        <p className="student-location__stay" data-stay-state={stay.stateAttr} hidden={!stay.showNotice}>
          {stay.noticeText}
        </p>
      ) : null}

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
            {locationUsageItems(mode).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="student-location__hint">{LOCATION_NO_PROMISE_TEXT}</p>
          {hints.map((text) => (
            <p key={text} className="student-location__hint">
              {text}
            </p>
          ))}
          <div className="student-location__actions">
            <button
              type="button"
              className="student-secondary"
              disabled={!realMode || !view.canLocate}
              onClick={onRetry}
            >
              {PRESENCE_RETRY_LABEL}
            </button>
            {view.canRetrySync ? (
              <button type="button" className="student-secondary" onClick={onRetrySync}>
                {PRESENCE_RETRY_SYNC_LABEL}
              </button>
            ) : null}
            <button
              type="button"
              className="student-secondary"
              disabled={!realMode || !view.canClear}
              onClick={onClear}
            >
              {PRESENCE_CLEAR_LABEL}
            </button>
          </div>
          {!realMode ? (
            <p className="student-location__hint">{LOCATION_SAMPLE_TEXT}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}