import { useState } from 'react';
import { ApiError, createRequestId } from '../../../shared';
import type { AdminSettings } from '../types';
import type {
  AdminSettingsSection,
  AdminSource,
  CrowdUpdatePayload,
  DiningUpdatePayload,
} from '../data/source';

interface SettingsDraftForm {
  name: string;
  radiusMeters: string;
  accuracyToleranceMeters: string;
  crowdedAt: string;
}

interface SaveErrorView {
  title: string;
  detail: string;
  conflict: boolean;
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateDiningDraft(
  form: SettingsDraftForm,
  settings: AdminSettings,
): { error: string | null; value: DiningUpdatePayload | null } {
  const name = form.name.trim();
  if (name.length === 0 || name.length > 120) {
    return { error: '食堂名称必须为 1—120 个字符。', value: null };
  }
  const radiusMeters = parseInteger(form.radiusMeters);
  if (radiusMeters === null || radiusMeters < 1 || radiusMeters > 5000) {
    return { error: '范围半径必须是 1—5000 的整数（米）。', value: null };
  }
  const accuracyToleranceMeters = parseInteger(form.accuracyToleranceMeters);
  if (accuracyToleranceMeters === null || accuracyToleranceMeters < 0 || accuracyToleranceMeters > 500) {
    return { error: '误差容忍必须是 0—500 的整数（米）。', value: null };
  }
  return {
    error: null,
    value: {
      canteenId: settings.dining.canteenId,
      name,
      center: settings.dining.center,
      radiusMeters,
      accuracyToleranceMeters,
      demo: settings.dining.demo,
    },
  };
}

function validateCrowdDraft(
  form: SettingsDraftForm,
  settings: AdminSettings,
): { error: string | null; value: CrowdUpdatePayload | null } {
  const crowdedAt = parseInteger(form.crowdedAt);
  if (crowdedAt === null || crowdedAt < 1 || crowdedAt > 1000) {
    return { error: '当前参考阈值必须是 1—1000 的整数（人）。', value: null };
  }
  return {
    error: null,
    value: {
      crowdedAt,
      demo: settings.crowd.demo,
    },
  };
}

function describeSaveError(error: unknown): SaveErrorView {
  if (error instanceof ApiError) {
    if (error.code === 'SETTING_VERSION_CONFLICT' || error.status === 409) {
      return {
        title: '配置已被他人修改',
        detail: `${error.message}（${error.code}）请重新读取最新配置后再保存；当前输入已保留，不会被自动覆盖。`,
        conflict: true,
      };
    }
    if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
      return {
        title: '配置未通过服务端校验',
        detail: `${error.message}（${error.code}）请修正后重试，当前输入已保留。`,
        conflict: false,
      };
    }
    if (error.code === 'REQUEST_CONFLICT') {
      return {
        title: '请求与首次提交不一致',
        detail: `${error.message}（${error.code}）请取消编辑后重新进入，生成新的 requestId。`,
        conflict: false,
      };
    }
    if (error.status === 401) {
      return {
        title: '身份失效',
        detail: '请到公共自检页重新登录管理员身份后重试；当前输入已保留。',
        conflict: false,
      };
    }
    if (error.status === 403) {
      return {
        title: '当前身份无管理权限',
        detail: `服务端拒绝了配置保存（${error.code}）。当前输入已保留，不提供切换管理员的按钮。`,
        conflict: false,
      };
    }
    if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
      return {
        title: '保存结果待确认',
        detail: '服务暂不可用；写操作可能未生效，也可能已经生效。请用同一 requestId 重试，不要重新进入编辑。当前输入已保留。',
        conflict: false,
      };
    }
    if (error.status === 0 || error.code === 'NETWORK_TIMEOUT' || error.code === 'NETWORK_ERROR') {
      return {
        title: '保存结果待确认',
        detail: `${error.message}（${error.code}）请用同一 requestId 重试，不要重新进入编辑；当前输入已保留。`,
        conflict: false,
      };
    }
    return {
      title: '保存失败',
      detail: `${error.message}（${error.code}）${
        error.retryable ? '写操作结果可能未确定；可用同一 requestId 重试。' : ''
      }`,
      conflict: false,
    };
  }
  return {
    title: '保存失败',
    detail: '请求没有完成，未确认配置是否生效；可用同一 requestId 重试。',
    conflict: false,
  };
}

function sampleModeError(): SaveErrorView {
  return {
    title: '样例模式不会保存',
    detail: '样例模式不会调用 PUT /admin/settings；请切换到真实服务并确认管理员会话后保存。当前输入仍保留。',
    conflict: false,
  };
}

function missingRequestIdError(): SaveErrorView {
  return { title: '缺少 requestId', detail: '请取消编辑后重新进入。', conflict: false };
}

interface SettingsEditorProps {
  source: AdminSource;
  settings: AdminSettings;
  onReloaded: (next: AdminSettings) => void;
}

export default function SettingsEditor({ source, settings, onReloaded }: SettingsEditorProps) {
  const [form, setForm] = useState<SettingsDraftForm | null>(null);
  const [diningRequestId, setDiningRequestId] = useState<string | null>(null);
  const [crowdRequestId, setCrowdRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState<AdminSettingsSection | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<SaveErrorView | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetEditState() {
    setForm(null);
    setDiningRequestId(null);
    setCrowdRequestId(null);
    setBusy(null);
    setFieldError(null);
    setSaveError(null);
  }

  function startEdit() {
    setForm({
      name: settings.dining.name,
      radiusMeters: String(settings.dining.radiusMeters),
      accuracyToleranceMeters: String(settings.dining.accuracyToleranceMeters),
      crowdedAt: String(settings.crowd.crowdedAt),
    });
    setDiningRequestId(createRequestId('admin-settings-dining'));
    setCrowdRequestId(createRequestId('admin-settings-crowd'));
    setFieldError(null);
    setSaveError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    resetEditState();
    setSuccess(null);
  }

  function updateField(field: keyof SettingsDraftForm, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    if (field === 'crowdedAt') {
      setCrowdRequestId(createRequestId('admin-settings-crowd'));
    } else {
      setDiningRequestId(createRequestId('admin-settings-dining'));
    }
    setFieldError(null);
    setSaveError(null);
    setSuccess(null);
  }

  async function reloadLatest(discardInput: boolean) {
    setBusy(null);
    setSaveError(null);
    try {
      const next = await source.getSettings();
      onReloaded(next);
      if (discardInput) {
        resetEditState();
        setSuccess('已重新读取服务端配置，未保存的输入已丢弃。');
      }
    } catch (loadError) {
      setSaveError(describeSaveError(loadError));
    }
  }

  async function submit(section: AdminSettingsSection) {
    if (!form || busy) {
      return;
    }
    setFieldError(null);
    setSaveError(null);
    setSuccess(null);

    if (section === 'dining') {
      const validated = validateDiningDraft(form, settings);
      if (validated.error || !validated.value) {
        setFieldError(validated.error);
        return;
      }
      if (source.mode === 'sample') {
        setSaveError(sampleModeError());
        return;
      }
      if (!diningRequestId) {
        setSaveError(missingRequestIdError());
        return;
      }
      setBusy('dining');
      try {
        const result = await source.updateSettings({
          section: 'dining',
          requestId: diningRequestId,
          expectedVersion: settings.dining.version,
          value: validated.value,
        });
        await confirmSaved('dining', result.version);
      } catch (error) {
        setSaveError(describeSaveError(error));
      } finally {
        setBusy(null);
      }
      return;
    }

    const validated = validateCrowdDraft(form, settings);
    if (validated.error || !validated.value) {
      setFieldError(validated.error);
      return;
    }
    if (source.mode === 'sample') {
      setSaveError(sampleModeError());
      return;
    }
    if (!crowdRequestId) {
      setSaveError(missingRequestIdError());
      return;
    }
    setBusy('crowd');
    try {
      const result = await source.updateSettings({
        section: 'crowd',
        requestId: crowdRequestId,
        expectedVersion: settings.crowd.version,
        value: validated.value,
      });
      await confirmSaved('crowd', result.version);
    } catch (error) {
      setSaveError(describeSaveError(error));
    } finally {
      setBusy(null);
    }
  }

  async function confirmSaved(section: AdminSettingsSection, savedVersion: number) {
    const label = section === 'dining' ? '食堂范围' : '提醒阈值';
    let next: AdminSettings;
    try {
      next = await source.getSettings();
    } catch {
      resetEditState();
      setSaveError({
        title: '已保存，但重新读取失败',
        detail: `服务端已接受 ${label} 保存（version ${savedVersion}）；页面无法重新读取确认，请刷新后再核对。`,
        conflict: false,
      });
      return;
    }
    onReloaded(next);
    const reloadedVersion = section === 'dining' ? next.dining.version : next.crowd.version;
    resetEditState();
    if (reloadedVersion === savedVersion) {
      setSuccess(`${label}已保存，服务端 version ${savedVersion}；重新读取一致，确认生效。`);
    } else {
      setSaveError({
        title: '保存后重新读取版本不一致',
        detail: `服务端返回 version ${savedVersion}，重新读取为 ${reloadedVersion}；请刷新复核，勿重复提交。`,
        conflict: false,
      });
    }
  }

  return (
    <div className="admin-section">
      <h3>配置编辑（S5 真实保存）</h3>
      <p className="admin-muted">
        可编辑白名单：dining 的 name、radiusMeters、accuracyToleranceMeters 与 crowd 的 crowdedAt。
        中心点不在此页编辑，保存时按服务端读取值原样回传；canteenId、demo 与 version 不可改。
        dining 与 crowd 分别保存，每次只提交一个 section，并携带各自的 requestId 与 expectedVersion。
      </p>

      {!form ? (
        <div className="admin-form__actions">
          <button type="button" className="admin-action" onClick={startEdit}>
            编辑配置
          </button>
          <span className="admin-muted">
            {source.mode === 'live'
              ? '保存会调用 PUT /admin/settings，并在成功后重新读取确认。'
              : '样例模式不会写入服务端；切到真实服务后可保存。'}
          </span>
        </div>
      ) : (
        <form
          className="admin-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="admin-form__grid">
            <label>
              <span>食堂名称</span>
              <input
                type="text"
                value={form.name}
                maxLength={120}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </label>
            <label>
              <span>范围半径（米）</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                step={1}
                value={form.radiusMeters}
                onChange={(event) => updateField('radiusMeters', event.target.value)}
              />
            </label>
            <label>
              <span>误差容忍（米）</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                step={1}
                value={form.accuracyToleranceMeters}
                onChange={(event) => updateField('accuracyToleranceMeters', event.target.value)}
              />
            </label>
            <label>
              <span>当前参考阈值（人）</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                step={1}
                value={form.crowdedAt}
                onChange={(event) => updateField('crowdedAt', event.target.value)}
              />
            </label>
          </div>

          <p className="admin-muted">
            dining 请求：requestId={diningRequestId ?? '未生成'} · expectedVersion=dining {settings.dining.version}
          </p>
          <p className="admin-muted">
            crowd 请求：requestId={crowdRequestId ?? '未生成'} · expectedVersion=crowd {settings.crowd.version}
          </p>
          <p className="admin-muted">
            修改 dining 字段会重新生成 dining 的 requestId；修改阈值会重新生成 crowd 的 requestId；
            失败后用同一 requestId 重试。
          </p>

          {fieldError ? (
            <p className="admin-form__error" role="alert">
              {fieldError}
            </p>
          ) : null}

          <div className="admin-form__actions">
            <button
              type="button"
              className="admin-action"
              disabled={busy !== null}
              onClick={() => void submit('dining')}
            >
              {busy === 'dining' ? '保存中…' : '保存食堂范围'}
            </button>
            <button
              type="button"
              className="admin-action"
              disabled={busy !== null}
              onClick={() => void submit('crowd')}
            >
              {busy === 'crowd' ? '保存中…' : '保存提醒阈值'}
            </button>
            <button type="button" className="admin-action" disabled={busy !== null} onClick={cancelEdit}>
              取消编辑
            </button>
          </div>
        </form>
      )}

      {saveError ? (
        <div className="notice admin-error" role="alert">
          <strong>{saveError.title}</strong>
          <p>{saveError.detail}</p>
          {saveError.conflict ? (
            <button
              type="button"
              className="admin-action"
              disabled={busy !== null}
              onClick={() => void reloadLatest(true)}
            >
              重新读取最新配置（放弃本次输入）
            </button>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <div className="notice" role="status">
          <strong>保存完成</strong>
          <p>{success}</p>
        </div>
      ) : null}

      <p className="admin-muted">
        冲突处理：服务端返回 SETTING_VERSION_CONFLICT 时保留当前输入，不自动覆盖；只有点击“重新读取最新配置”才会丢弃输入。
        保存成功后页面会重新读取一次，并以服务端返回的 version 为准。
      </p>
    </div>
  );
}