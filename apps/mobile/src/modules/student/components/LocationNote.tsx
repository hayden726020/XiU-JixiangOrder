import { useState } from 'react';

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
            <li>用途：仅用于辅助判断你是否在食堂附近，帮助展示堂食参考。</li>
            <li>频率：只在你主动点击时获取一次，不持续跟踪。</li>
            <li>范围：坐标只在手机内完成范围判断，不上传、不保存、不写日志。</li>
            <li>影响：拒绝或定位失败不影响选餐、堂食和外带下单。</li>
            <li>清除：可随时清除本人的位置判断记录；清除不会删除订单。</li>
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