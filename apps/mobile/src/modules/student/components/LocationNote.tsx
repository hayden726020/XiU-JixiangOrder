import { useState } from 'react';
import { LOCATION_USAGE_ITEMS } from './locationTexts';

const SAMPLE_POSITION_HINT = '当前为样例模式，第二天接入公共定位方法';

export default function LocationNote() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState('');

  function updatePosition(): void {
    setHint(SAMPLE_POSITION_HINT);
  }

  return (
    <section className="student-location" aria-labelledby="student-location-title">
      <button
        type="button"
        className="student-location__toggle"
        aria-expanded={open}
        aria-controls="student-location-body"
        onClick={() => setOpen((value) => !value)}
      >
        <span id="student-location-title" className="student-location__title">
          关于位置信息
        </span>
        <span className="student-location__state">{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <div id="student-location-body" className="student-location__body">
          <ul className="student-location__list">
            {LOCATION_USAGE_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button type="button" className="student-secondary" onClick={updatePosition}>
            更新我的位置（样例模式）
          </button>
          {hint ? (
            <p className="student-location__hint" role="status">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}