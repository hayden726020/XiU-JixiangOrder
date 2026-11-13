import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  DEMO_DINING_CONFIG,
  RequestIdGuard,
  checkLocationPermission,
  checkPresenceOnce,
  clearPresence,
  demoLogin,
  fetchDiningConfig,
  getApiBaseInfo,
  getSession,
  logout,
  reportPresence,
  roleLabel,
  subscribeSession,
  type DiningConfig,
  type Presence,
  type PresenceCheckResult,
  type PresenceReason,
  type Session,
} from '../shared';

type BusyAction = 'login' | 'logout' | 'config' | 'location' | 'report' | 'clear' | null;

const presenceLabel: Record<Presence, string> = {
  INSIDE: '范围内',
  OUTSIDE: '范围外',
  UNKNOWN: '无法判断',
};

const reasonLabel: Record<PresenceReason, string> = {
  OK: '判断完成',
  PERMISSION_DENIED: '定位权限被拒绝',
  PERMISSION_RESTRICTED: '权限受限或未授予',
  POSITION_UNAVAILABLE: '无法获取位置',
  TIMEOUT: '定位超时',
  ACCURACY_TOO_LOW: '定位误差过大',
  BOUNDARY_UNCERTAIN: '边界不确定',
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}（${error.code}）`;
  }
  return '发生未预期错误，未执行成功。';
}

export default function SystemCheck() {
  const [session, setSessionState] = useState<Session | null>(getSession);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DiningConfig | null>(null);
  const [configSource, setConfigSource] = useState<'server' | 'demo' | null>(null);
  const [permission, setPermission] = useState<string>('未检查');
  const [result, setResult] = useState<PresenceCheckResult | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [requestGuard] = useState(() => new RequestIdGuard('location'));

  const baseInfo = getApiBaseInfo();

  useEffect(() => subscribeSession(() => setSessionState(getSession())), []);

  useEffect(() => {
    void checkLocationPermission().then((value) => setPermission(value));
  }, []);

  function begin(action: BusyAction): void {
    setBusy(action);
    setError(null);
    setMessage(null);
  }

  async function onLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    begin('login');
    try {
      const next = await demoLogin(account, password);
      setPassword('');
      setMessage(`已登录为${next.user.displayName}（${roleLabel(next.user.role)}），角色由服务端返回。`);
    } catch (loginError) {
      setError(describeError(loginError));
    } finally {
      setBusy(null);
    }
  }

  async function onLogout(): Promise<void> {
    begin('logout');
    try {
      await logout();
      setMessage('已退出，并清除本机会话。');
    } catch (logoutError) {
      setError(describeError(logoutError));
    } finally {
      setBusy(null);
    }
  }

  async function onLoadConfig(): Promise<void> {
    begin('config');
    try {
      const next = await fetchDiningConfig();
      setConfig(next);
      setConfigSource('server');
      setMessage(`已读取食堂范围配置：${next.name}。`);
    } catch (configError) {
      setError(describeError(configError));
    } finally {
      setBusy(null);
    }
  }

  async function onCheckLocation(): Promise<void> {
    begin('location');
    try {
      let nextConfig = config;
      let source = configSource;
      if (!nextConfig) {
        try {
          nextConfig = await fetchDiningConfig();
          source = 'server';
        } catch {
          nextConfig = DEMO_DINING_CONFIG;
          source = 'demo';
          setMessage('未读到服务端配置，本次使用演示范围参数；结果仅用于验证权限路径。');
        }
      }
      setConfig(nextConfig);
      setConfigSource(source);
      const next = await checkPresenceOnce(nextConfig);
      setPermission(next.permission);
      setResult(next);
      if (source === 'demo') {
        setMessage('定位判断使用演示范围参数，不代表真实食堂范围。');
      } else {
        setMessage(`定位判断完成：${presenceLabel[next.presence]}。`);
      }
      requestGuard.reset();
      setReportText(null);
    } catch (locationError) {
      setError(describeError(locationError));
    } finally {
      setBusy(null);
    }
  }

  async function onReport(): Promise<void> {
    if (!result) {
      return;
    }
    begin('report');
    try {
      const report = await reportPresence(result.presence, requestGuard.getId());
      setReportText(`已上报 ${presenceLabel[report.presence]}，服务端记录时间 ${report.observedAt}，过期时间 ${report.expiresAt}。`);
      requestGuard.reset();
    } catch (reportError) {
      setError(describeError(reportError));
    } finally {
      setBusy(null);
    }
  }

  async function onClear(): Promise<void> {
    begin('clear');
    try {
      await clearPresence();
      setReportText('已请求服务端删除本人位置判断记录；订单不受影响。');
    } catch (clearError) {
      setError(describeError(clearError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="module-panel check-panel" aria-labelledby="system-check-title">
      <span className="badge">公共层自检 · 不代表角色授权</span>
      <h2 id="system-check-title">公共能力自检</h2>
      <p className="lead">
        用于在真机检查登录接口、服务地址、一次性定位授权与拒绝路径。页面不读取、不显示、不保存精确坐标，也不回退到样例成功。
      </p>

      <div className="check-block">
        <h3>服务地址与会话</h3>
        <dl className="check-list">
          <div>
            <dt>服务地址</dt>
            <dd>{baseInfo.baseUrl ?? '未配置'}</dd>
          </div>
          <div>
            <dt>来源 / 状态</dt>
            <dd>{baseInfo.problem ?? `已配置（${baseInfo.source}）`}</dd>
          </div>
          <div>
            <dt>当前会话</dt>
            <dd>
              {session
                ? `${session.user.displayName} · ${roleLabel(session.user.role)} · 过期 ${session.expiresAt}`
                : '未登录'}
            </dd>
          </div>
        </dl>

        {session ? (
          <button type="button" className="check-action" onClick={() => void onLogout()} disabled={busy !== null}>
            {busy === 'logout' ? '正在退出…' : '退出登录'}
          </button>
        ) : (
          <form className="check-form" onSubmit={(event) => void onLogin(event)}>
            <label className="check-field">
              <span>演示账号</span>
              <input
                type="text"
                autoComplete="username"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="由 spcuteag 线下交付"
              />
            </label>
            <label className="check-field">
              <span>密码</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="不写入日志或示例"
              />
            </label>
            <button type="submit" className="check-action" disabled={busy !== null}>
              {busy === 'login' ? '正在登录…' : '演示登录'}
            </button>
          </form>
        )}
      </div>

      <div className="check-block">
        <h3>一次性定位</h3>
        <dl className="check-list">
          <div>
            <dt>权限状态</dt>
            <dd>{permission}</dd>
          </div>
          <div>
            <dt>范围配置</dt>
            <dd>
              {config
                ? `${config.canteenId} · 半径 ${config.radiusMeters} 米 · 误差容忍 ${config.accuracyToleranceMeters} 米 · ${
                    configSource === 'demo' ? '演示参数' : config.demo ? '服务端标记演示' : '服务端配置'
                  }`
                : '尚未读取'}
            </dd>
          </div>
          <div>
            <dt>判断结果</dt>
            <dd>
              {result
                ? `${presenceLabel[result.presence]} · ${reasonLabel[result.reason]}${result.demoConfig ? ' · 演示范围' : ''}`
                : '尚未判断'}
            </dd>
          </div>
        </dl>

        <div className="check-actions">
          <button type="button" className="check-action" onClick={() => void onLoadConfig()} disabled={busy !== null}>
            {busy === 'config' ? '读取中…' : '读取范围配置'}
          </button>
          <button type="button" className="check-action" onClick={() => void onCheckLocation()} disabled={busy !== null}>
            {busy === 'location' ? '定位中…' : '请求一次定位'}
          </button>
          <button
            type="button"
            className="check-action"
            onClick={() => void onReport()}
            disabled={busy !== null || !result || !session}
          >
            {busy === 'report' ? '上报中…' : '上报范围判断'}
          </button>
          <button
            type="button"
            className="check-action"
            onClick={() => void onClear()}
            disabled={busy !== null || !session}
          >
            {busy === 'clear' ? '清除中…' : '清除本人位置记录'}
          </button>
        </div>

        {reportText ? <p className="check-ok">{reportText}</p> : null}
      </div>

      {message ? <p className="check-ok">{message}</p> : null}
      {error ? <p className="check-error">{error}</p> : null}

      <p className="hint">
        定位按钮只在主动点击后请求一次权限；拒绝或失败仍可继续下单。精确坐标只在本次判断的设备内存中使用，页面与服务端均不接收；“上报范围判断”只发送 INSIDE / OUTSIDE / UNKNOWN。
      </p>
    </section>
  );
}