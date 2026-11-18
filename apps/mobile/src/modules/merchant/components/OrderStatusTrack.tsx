import type { MerchantOrder } from '../data/types';
import { buildStatusTrack } from '../state/statusTrack';
import { IconAlertTriangle, IconCheck, IconCircleX } from './MerchantIcons';

interface OrderStatusTrackProps {
  order: MerchantOrder;
}

export default function OrderStatusTrack({ order }: OrderStatusTrackProps) {
  const track = buildStatusTrack(order);

  return (
    <div
      className="od-progress"
      data-pending={track.pendingTone}
      data-cancelled={track.cancelled ? 'true' : 'false'}
    >
      <ol className="od-progress__steps">
        {track.steps.map((step, index) => {
          const finalDone = step.status === 'COMPLETED' && step.state === 'current';
          return (
            <li
              key={step.status}
              aria-current={step.state === 'current' ? 'step' : undefined}
              className={`od-progress__step is-${step.state}${finalDone ? ' is-final' : ''}`}
            >
              <span className="od-progress__node">
                <span className="od-progress__dot">
                  {(step.state === 'done' || finalDone) && <IconCheck size={10} />}
                </span>
                {index < track.steps.length - 1 && (
                  <span
                    className={`od-progress__line${step.state === 'done' ? ' is-done' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="od-progress__label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {track.cancelled && (
        <div className="od-progress__halt">
          <IconCircleX size={16} />
          <span>流程已终止：该订单未按正常主流程完成。</span>
        </div>
      )}

      {track.active && (
        <div className="od-progress__pending">
          <IconAlertTriangle size={16} />
          <span>{track.pendingDetail}</span>
        </div>
      )}

      {track.active || track.cancelled || track.pendingTone === 'cleared' ? (
        <p className="od-progress__note">{track.note}</p>
      ) : null}
    </div>
  );
}