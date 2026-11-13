import type { SlotGuardState } from '../state/slotGuard';
import { toCrowdView } from '../utils/crowdView';

export interface CrowdHintProps {
  slotRange: string | null;
  state: SlotGuardState;
}

export default function CrowdHint({ slotRange, state }: CrowdHintProps) {
  if (!slotRange) {
    return null;
  }

  const titleId = 'student-crowd-title';
  const heading = (
    <h3 id={titleId} className="student-section-title">
      堂食参考 · {slotRange}
    </h3>
  );

  if (state.loading) {
    return (
      <section className="student-crowd" aria-labelledby={titleId} aria-busy="true">
        {heading}
        <p className="student-crowd__loading">正在读取该时段信息…</p>
      </section>
    );
  }

  if (state.error || !state.crowd) {
    return (
      <section className="student-crowd is-muted" aria-labelledby={titleId}>
        {heading}
        <p className="student-crowd__empty">信息不足，请以现场为准</p>
      </section>
    );
  }

  const view = toCrowdView(state.crowd);
  const metaText = [view.updatedText, view.demoText].filter((text) => text !== '').join(' · ');

  return (
    <section
      className={`student-crowd is-${view.level.toLowerCase()}${view.expired ? ' is-muted' : ''}`}
      aria-labelledby={titleId}
    >
      {heading}
      <p className="student-crowd__title">{view.expired ? '信息已过期' : view.title}</p>
      <p className="student-crowd__detail">
        {view.expired ? '信息不足，请以现场为准' : view.detail}
      </p>
      {view.expired ? null : (
        <>
          {view.reservedText ? <p className="student-crowd__numbers">{view.reservedText}</p> : null}
          {view.currentText ? <p className="student-crowd__numbers">{view.currentText}</p> : null}
          {view.basisText ? <p className="student-crowd__basis">{view.basisText}</p> : null}
        </>
      )}
      {metaText ? <p className="student-crowd__meta">{metaText}</p> : null}
    </section>
  );
}