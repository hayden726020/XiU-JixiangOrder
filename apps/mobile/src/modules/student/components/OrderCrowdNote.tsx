import { useState } from 'react';
import type { CrowdView } from '../utils/crowdView';
import { ORDER_CROWD_NOTE } from '../utils/orderDetailTexts';
import { LOCATION_USAGE_ITEMS } from './locationTexts';

export interface OrderCrowdNoteProps {
  crowd: CrowdView | null;
}

export default function OrderCrowdNote({ crowd }: OrderCrowdNoteProps) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="student-location student-order-crowd"
      aria-labelledby="student-order-crowd-title"
    >
      <button
        type="button"
        className="student-location__toggle"
        aria-expanded={open}
        aria-controls="student-order-crowd-body"
        onClick={() => setOpen((value) => !value)}
      >
        <span id="student-order-crowd-title" className="student-location__title">
          定位与拥挤说明
        </span>
        <span className="student-location__state">{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <div id="student-order-crowd-body" className="student-location__body">
          <ul className="student-location__list">
            {LOCATION_USAGE_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="student-order-note">{ORDER_CROWD_NOTE}</p>
          {crowd ? (
            <>
              {crowd.basisText ? <p className="student-order-note">{crowd.basisText}</p> : null}
              <p className="student-order-note">
                {crowd.updatedText ? `${crowd.updatedText}，10 分钟后失效` : '信息不足，请以现场为准'}
              </p>
              {crowd.demoText ? <p className="student-order-note">{crowd.demoText}</p> : null}
            </>
          ) : (
            <p className="student-order-note">信息不足，请以现场为准</p>
          )}
        </div>
      ) : null}
    </section>
  );
}