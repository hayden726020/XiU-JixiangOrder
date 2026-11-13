import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import SettingsEditor from '../components/SettingsEditor';
import type { AdminSource } from '../data/source';
import { sampleStalls } from '../data/sample';
import type { AdminSettings } from '../types';
import { formatDateTime } from '../utils/display';

interface SettingsError {
  title: string;
  detail: string;
}

function describeError(error: unknown): SettingsError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        title: '身份失效',
        detail: '请到公共自检页重新登录管理员演示身份后再读取配置；页面未显示任何配置。',
      };
    }
    if (error.status === 403) {
      return {
        title: '当前身份无管理权限',
        detail: `服务端拒绝读取配置（${error.code}）。页面不会显示样例配置冒充真实结果，也不提供切换管理员的按钮。`,
      };
    }
    if (error.status === 404) {
      return {
        title: '配置尚未初始化',
        detail: `${error.message}（${error.code}）`,
      };
    }
    if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
      return {
        title: '配置读取未完成',
        detail: '服务暂不可用；这是查询请求，可重试。页面未显示样例数据。',
      };
    }
    if (error.status === 0 || error.code === 'NETWORK_TIMEOUT') {
      return {
        title: '配置读取未完成',
        detail: `${error.message}（${error.code}）请检查网络与服务地址后重试；页面未显示样例数据。`,
      };
    }
    return {
      title: '配置读取失败',
      detail: `${error.message}（${error.code}）`,
    };
  }
  return {
    title: '配置读取失败',
    detail: '无法读取配置，未显示样例数据。请检查服务地址与登录状态。',
  };
}

function demoLabel(demo: boolean): string {
  return demo ? '服务端标注为演示值，未经现场验证' : '非演示值，仍需现场核准';
}

interface SettingsPageProps {
  source: AdminSource;
}

export default function SettingsPage({ source }: SettingsPageProps) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SettingsError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    source
      .getSettings()
      .then((next) => {
        if (!cancelled) {
          setSettings(next);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(describeError(loadError));
          setSettings(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, attempt]);

  return (
    <div className="admin-section">
      <h3>营业与食堂配置</h3>
      <p className="admin-muted">
        {source.mode === 'live'
          ? '真实服务只读，数据来自 GET /admin/settings 的 dining 与 crowd 两段。'
          : '样例只读配置，不会请求服务端。'}
        S3 已按服务端结构只读对齐；S5 已接入 PUT /admin/settings，dining 与 crowd 分别保存、成功后重新读取确认，冲突时保留输入；S6 的 401/403/503 错误态不显示样例配置。
      </p>

      {loading ? <p className="admin-muted">正在读取配置…</p> : null}

      {error ? (
        <div className="notice admin-error" role="alert">
          <strong>{error.title}</strong>
          <p>{error.detail}</p>
          <button type="button" className="admin-action" onClick={() => setAttempt((value) => value + 1)}>
            重试
          </button>
          <a href="#/system-check">去公共自检页检查登录与服务 →</a>
        </div>
      ) : null}

      {!loading && !error && settings ? (
        <>
          <h3>食堂范围</h3>
          <dl className="admin-kv">
            <div>
              <dt>食堂</dt>
              <dd>
                {settings.dining.name}（{settings.dining.canteenId}）
              </dd>
            </div>
            <div>
              <dt>中心点</dt>
              <dd>已配置；原始坐标不在管理页展示，仅用于学生端设备内范围判断</dd>
            </div>
            <div>
              <dt>范围半径</dt>
              <dd>{settings.dining.radiusMeters} 米</dd>
            </div>
            <div>
              <dt>误差容忍</dt>
              <dd>{settings.dining.accuracyToleranceMeters} 米，超过或边界不确定时判为未知</dd>
            </div>
            <div>
              <dt>配置版本</dt>
              <dd>version {settings.dining.version}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>
                {settings.dining.updatedAt
                  ? formatDateTime(settings.dining.updatedAt)
                  : '服务端未返回 updatedAt'}
              </dd>
            </div>
          </dl>
          <p className="admin-muted">{demoLabel(settings.dining.demo)}。</p>

          <h3>提醒条件</h3>
          <dl className="admin-kv">
            <div>
              <dt>当前参考阈值</dt>
              <dd>
                {settings.crowd.crowdedAt} 人（服务端字段 crowdedAt，version {settings.crowd.version}）
              </dd>
            </div>
            <div>
              <dt>预约需求阈值</dt>
              <dd>服务端未提供；契约要求两类阈值分开比较，页面不以样例值填充</dd>
            </div>
          </dl>
          <p className="admin-muted">
            {demoLabel(settings.crowd.demo)}。阈值只用于人数提醒提示，不表示食堂真实人数，也不保证有座位。
          </p>

          <h3>档口营业时间</h3>
          {source.mode === 'sample' ? (
            <>
              {sampleStalls.map((stall) => (
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
              <p className="admin-muted">
                以上为样例演示值。服务端当前没有档口营业时间端点，真实模式不显示这些数据。
              </p>
            </>
          ) : (
            <div className="notice">
              <strong>服务端未提供档口营业时间</strong>
              <p>
                GET /admin/settings 当前只有 dining 与 crowd 两段，没有档口时段、启用状态或档口名称。
                “管理端维护、档口只读”的字段与端点仍待确认，页面不用样例值冒充真实配置。
              </p>
            </div>
          )}

          <SettingsEditor source={source} settings={settings} onReloaded={setSettings} />
        </>
      ) : null}

      <p className="hint">
        真实读写使用 GET /admin/settings 与 PUT /admin/settings；PUT 的 requestId、section、expectedVersion
        与 SETTING_VERSION_CONFLICT 已在 DRAFT v0.3 中定义。页面每次只提交一个 section，保存后重新读取一次确认版本。
      </p>
    </div>
  );
}