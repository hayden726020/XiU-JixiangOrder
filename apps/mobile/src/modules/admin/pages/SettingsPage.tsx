import type { AdminSettings } from '../types';
import { formatDateTime } from '../utils/display';

interface SettingsPageProps {
  settings: AdminSettings;
}

export default function SettingsPage({ settings }: SettingsPageProps) {
  return (
    <div className="admin-section">
      <h3>营业与食堂配置</h3>
      <p className="admin-muted">
        只读样例，配置版本 {settings.version}，更新于 {formatDateTime(settings.updatedAt)}。保存、版本冲突与真实接口在 S4 接入。
      </p>

      <h3>档口营业时间</h3>
      {settings.stalls.map((stall) => (
        <div key={stall.stallId} className="admin-order">
          <div className="admin-order__head">
            <strong>{stall.name}</strong>
            <span className="admin-tag">{stall.enabled ? '营业中' : '已停用'}</span>
          </div>
          <div className="admin-order__meta">
            <span>{stall.stallId}</span>
            <ul className="admin-hours" aria-label={`${stall.name}营业时间`}>
              {stall.businessHours.map((hours) => (
                <li key={`${hours.start}-${hours.end}`}>
                  {hours.start}—{hours.end}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      <p className="admin-muted">营业时间由管理端维护，档口只读；本页暂无编辑控件。</p>

      <h3>食堂范围</h3>
      <dl className="admin-kv">
        <div>
          <dt>食堂</dt>
          <dd>
            {settings.canteenName}（{settings.canteenId}）
          </dd>
        </div>
        <div>
          <dt>位置基准</dt>
          <dd>{settings.centerLabel}</dd>
        </div>
        <div>
          <dt>范围半径</dt>
          <dd>{settings.radiusMeters} 米</dd>
        </div>
        <div>
          <dt>误差容忍</dt>
          <dd>{settings.accuracyToleranceMeters} 米，超过或边界不确定时判为未知</dd>
        </div>
      </dl>

      <h3>提醒条件</h3>
      <dl className="admin-kv">
        <div>
          <dt>预约需求阈值</dt>
          <dd>{settings.alerts.reservedDineInThreshold} 人（演示值）</dd>
        </div>
        <div>
          <dt>当前参考阈值</dt>
          <dd>{settings.alerts.currentReferenceThreshold} 人（演示值）</dd>
        </div>
      </dl>
      <p className="admin-muted">
        两类人数分开比较，不相加。阈值未经现场验证，不表示食堂真实人数，也不保证有座位。
      </p>

      <p className="hint">
        真实读写将使用 <code>GET /admin/settings</code> 与 <code>PUT /admin/settings</code>；字段结构、可改白名单和配置版本冲突码仍待确认。
      </p>
    </div>
  );
}