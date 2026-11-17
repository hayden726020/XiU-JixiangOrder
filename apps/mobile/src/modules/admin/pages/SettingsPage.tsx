import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared';
import '../admin-settings.css';
import AdminBackLink from '../components/AdminBackLink';
import SettingsEditor from '../components/SettingsEditor';
import { sampleStalls } from '../data/sample';
import type { AdminSource } from '../data/source';
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

function demoNote(demo: boolean): string {
  return demo ? '服务端标注为演示值，未经现场验证' : '当前配置非演示值，仍需现场核准';
}

function centerLabel(settings: AdminSettings): string {
  const { latitude, longitude } = settings.dining.center;
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? '已配置' : '未配置';
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.6V8l2.4 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface SettingsPageProps {
  source: AdminSource;
}

export default function SettingsPage({ source }: SettingsPageProps) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SettingsError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);

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
          setEditing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, attempt]);

  return (
    <div className={`admin-settings${editing ? ' admin-settings--editing' : ''}`}>
      <header className="admin-settings__header">
        {editing ? (
          <AdminBackLink
            to="/admin/settings"
            label="返回配置详情"
            onBack={() => setEditing(false)}
          />
        ) : (
          <AdminBackLink to="/admin" label="返回管理端概览" />
        )}
        {!editing ? (
          <>
            <h2 className="admin-settings__title" id="admin-title">营业与食堂配置</h2>
            <p className="admin-settings__subtitle">查看食堂范围与提醒阈值，可分别编辑保存</p>
          </>
        ) : null}
      </header>

      {loading ? (
        <p className="admin-settings__loading" role="status">
          正在读取配置…
        </p>
      ) : null}

      {error ? (
        <div className="notice admin-error admin-settings__error" role="alert">
          <strong>{error.title}</strong>
          <p>{error.detail}</p>
          <button
            type="button"
            className="admin-action"
            onClick={() => setAttempt((value) => value + 1)}
          >
            重试
          </button>
          <a href="#/system-check">去公共自检页检查登录与服务 →</a>
        </div>
      ) : null}

      {!loading && !error && settings ? (
        <>
          {!editing ? (
            <>
          <section className="admin-settings__block" aria-labelledby="admin-settings-dining">
            <h3 id="admin-settings-dining">食堂范围</h3>
            <dl className="admin-settings__card admin-settings__kv">
              <div>
                <dt>食堂</dt>
                <dd>{settings.dining.name}</dd>
              </div>
              <div>
                <dt>中心点</dt>
                <dd>{centerLabel(settings)}</dd>
              </div>
              <div>
                <dt>范围半径</dt>
                <dd>{settings.dining.radiusMeters} 米</dd>
              </div>
              <div>
                <dt>误差容忍</dt>
                <dd>{settings.dining.accuracyToleranceMeters} 米</dd>
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
                    : '服务端未返回'}
                </dd>
              </div>
            </dl>
            <p className="admin-settings__note">
              {demoNote(settings.dining.demo)}
            </p>
          </section>

          <section className="admin-settings__block" aria-labelledby="admin-settings-crowd">
            <h3 id="admin-settings-crowd">提醒条件</h3>
            <dl className="admin-settings__card admin-settings__kv">
              <div>
                <dt>当前参考阈值</dt>
                <dd>{settings.crowd.crowdedAt} 人</dd>
              </div>
              <div>
                <dt>预约需求阈值</dt>
                <dd>待接入</dd>
              </div>
            </dl>

          </section>

          <section className="admin-settings__block" aria-labelledby="admin-settings-stalls">
            <h3 id="admin-settings-stalls">档口营业时间</h3>
            {source.mode === 'sample' ? (
              <>
                <div className="admin-settings__stalls">
                  {sampleStalls.map((stall) => (
                    <article key={stall.stallId} className="admin-settings__stall">
                      <div className="admin-settings__stall-head">
                        <strong>{stall.name}</strong>
                        <span
                          className={`admin-settings__badge${stall.enabled ? '' : ' admin-settings__badge--off'}`}
                        >
                          {stall.enabled ? '营业中' : '已停用'}
                        </span>
                      </div>
                      <ul className="admin-settings__hours" aria-label={`${stall.name}营业时间`}>
                        {stall.businessHours.map((hours) => (
                          <li key={`${hours.start}-${hours.end}`}>
                            <ClockIcon />
                            {hours.start}–{hours.end}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="admin-settings__stall admin-settings__stall--empty">
                <strong>档口营业时间待接入</strong>
                <p>当前展示食堂范围与提醒阈值，不显示未经确认的档口时段。</p>
              </div>
            )}
          </section>
            </>
          ) : null}

          <div className={`admin-settings__footer${editing ? ' admin-settings__footer--editing' : ''}`}>
            {editing ? (
              <div className="admin-settings__editor">
                <SettingsEditor
                  source={source}
                  settings={settings}
                  onReloaded={setSettings}
                  onDone={() => setEditing(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                className="admin-settings__primary"
                onClick={() => setEditing(true)}
              >
                编辑配置
              </button>
            )}
          </div>
        </>
      ) : null}

      {loading || error ? (
        <div className="admin-settings__footer">
          <button type="button" className="admin-settings__primary" disabled>
            编辑配置
          </button>
        </div>
      ) : null}
    </div>
  );
}