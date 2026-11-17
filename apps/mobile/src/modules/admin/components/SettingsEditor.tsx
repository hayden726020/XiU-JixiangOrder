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
  tone: 'warning' | 'error';
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
        detail: '当前输入已保留，不会被自动覆盖',
        conflict: true,
        tone: 'warning',
      };
    }
    if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
      return {
        title: '配置未通过服务端校验',
        detail: '请修正后重试，当前输入已保留',
        conflict: false,
        tone: 'error',
      };
    }
    if (error.code === 'REQUEST_CONFLICT') {
      return {
        title: '请求与首次提交不一致',
        detail: '请取消编辑后重新进入，当前输入已保留',
        conflict: false,
        tone: 'error',
      };
    }
    if (error.status === 401) {
      return {
        title: '身份失效',
        detail: '请到公共自检页重新登录管理员身份后重试，当前输入已保留',
        conflict: false,
        tone: 'error',
      };
    }
    if (error.status === 403) {
      return {
        title: '当前身份无管理权限',
        detail: '服务端拒绝了配置保存，当前输入已保留',
        conflict: false,
        tone: 'error',
      };
    }
    if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
      return {
        title: '保存结果待确认',
        detail: '服务暂不可用，请保持当前编辑状态后重试',
        conflict: false,
        tone: 'warning',
      };
    }
    if (error.status === 0 || error.code === 'NETWORK_TIMEOUT' || error.code === 'NETWORK_ERROR') {
      return {
        title: '保存结果待确认',
        detail: '网络连接异常，请保持当前编辑状态后重试',
        conflict: false,
        tone: 'warning',
      };
    }
    return {
      title: '保存失败',
      detail: '保存未完成，当前输入已保留，请重试',
      conflict: false,
      tone: 'error',
    };
  }
  return {
    title: '保存失败',
    detail: '保存未完成，当前输入已保留，请重试',
    conflict: false,
    tone: 'error',
  };
}

function sampleModeError(): SaveErrorView {
  return {
    title: '样例模式不会保存',
    detail: '切换到真实服务并确认管理员会话后可保存，当前输入已保留',
    conflict: false,
    tone: 'warning',
  };
}

function missingRequestIdError(): SaveErrorView {
  return {
    title: '缺少提交标识',
    detail: '请取消编辑后重新进入',
    conflict: false,
    tone: 'error',
  };
}

interface SettingsEditorProps {
  source: AdminSource;
  settings: AdminSettings;
  onReloaded: (next: AdminSettings) => void;
  onDone: () => void;
}

export default function SettingsEditor({ source, settings, onReloaded, onDone }: SettingsEditorProps) {
  const [form, setForm] = useState<SettingsDraftForm>({
    name: settings.dining.name,
    radiusMeters: String(settings.dining.radiusMeters),
    accuracyToleranceMeters: String(settings.dining.accuracyToleranceMeters),
    crowdedAt: String(settings.crowd.crowdedAt),
  });
  const [diningRequestId, setDiningRequestId] = useState<string | null>(() =>
    createRequestId('admin-settings-dining'),
  );
  const [crowdRequestId, setCrowdRequestId] = useState<string | null>(() =>
    createRequestId('admin-settings-crowd'),
  );
  const [busy, setBusy] = useState<AdminSettingsSection | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<SaveErrorView | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetEditState() {
    setBusy(null);
    setFieldError(null);
    setSaveError(null);
  }

  function closeEditor() {
    resetEditState();
    setSuccess(null);
    onDone();
  }

  function updateField(field: keyof SettingsDraftForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
        setForm({
          name: next.dining.name,
          radiusMeters: String(next.dining.radiusMeters),
          accuracyToleranceMeters: String(next.dining.accuracyToleranceMeters),
          crowdedAt: String(next.crowd.crowdedAt),
        });
        setDiningRequestId(createRequestId('admin-settings-dining'));
        setCrowdRequestId(createRequestId('admin-settings-crowd'));
        setSuccess('已重新读取服务端配置，未保存的输入已丢弃。');
      }
    } catch (loadError) {
      setSaveError(describeSaveError(loadError));
    }
  }

  async function submit(section: AdminSettingsSection) {
    if (busy) {
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
        detail: `服务端已接受 ${label} 保存（version ${savedVersion}）；页面无法重新读取确认，请刷新后再核对`,
        conflict: false,
        tone: 'error',
      });
      return;
    }
    onReloaded(next);
    const reloadedVersion = section === 'dining' ? next.dining.version : next.crowd.version;
    resetEditState();
    if (reloadedVersion === savedVersion) {
      setForm({
        name: next.dining.name,
        radiusMeters: String(next.dining.radiusMeters),
        accuracyToleranceMeters: String(next.dining.accuracyToleranceMeters),
        crowdedAt: String(next.crowd.crowdedAt),
      });
      setDiningRequestId(createRequestId('admin-settings-dining'));
      setCrowdRequestId(createRequestId('admin-settings-crowd'));
      setSuccess(`${label}已保存，服务端 version ${savedVersion}；重新读取一致，确认生效`);
    } else {
      setSaveError({
        title: '保存后重新读取版本不一致',
        detail: `服务端返回 version ${savedVersion}，重新读取为 ${reloadedVersion}；请刷新复核，勿重复提交`,
        conflict: false,
        tone: 'error',
      });
    }
  }

  return (
    <div className="admin-settings__form admin-settings__form--edit">
      <header className="admin-settings__form-header">
        <h3 id="admin-title">编辑配置</h3>
        <p>dining 与 crowd 分两次提交</p>
      </header>

      <div className="admin-settings__form-grid">
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
          <span className="admin-settings__input-unit">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              step={1}
              value={form.radiusMeters}
              onChange={(event) => updateField('radiusMeters', event.target.value)}
            />
            <span>米</span>
          </span>
        </label>
        <label>
          <span>误差容忍（米）</span>
          <span className="admin-settings__input-unit">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              step={1}
              value={form.accuracyToleranceMeters}
              onChange={(event) => updateField('accuracyToleranceMeters', event.target.value)}
            />
            <span>米</span>
          </span>
        </label>
        <label>
          <span>当前参考阈值（人）</span>
          <span className="admin-settings__input-unit">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              step={1}
              value={form.crowdedAt}
              onChange={(event) => updateField('crowdedAt', event.target.value)}
            />
            <span>人</span>
          </span>
        </label>
      </div>

      <details className="admin-settings__version" open>
        <summary>
          <span aria-hidden="true">▾</span>
          提交信息：dining v{settings.dining.version} · crowd v{settings.crowd.version}
        </summary>
        <p className="admin-settings__form-hint">
          {source.mode === 'live'
            ? '两组分别提交，保存成功后重新读取确认版本；冲突时保留输入，不自动覆盖。'
            : '样例模式仅用于预览，不会写入服务端。'}
        </p>
      </details>

      {fieldError ? (
        <p className="admin-settings__form-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      {saveError ? (
        <div
          className={`admin-settings__feedback admin-settings__feedback--${saveError.tone}`}
          role="alert"
        >
          <strong>{saveError.title}</strong>
          <p>{saveError.detail}</p>
          {saveError.conflict ? (
            <div className="admin-settings__feedback-actions">
              <button
                type="button"
                className="admin-settings__feedback-action"
                disabled={busy !== null}
                onClick={() => void reloadLatest(true)}
              >
                重新读取最新配置
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <div className="admin-settings__feedback admin-settings__feedback--success" role="status">
          <strong>保存完成</strong>
          <p>{success}</p>
        </div>
      ) : null}

      <div className="admin-settings__submit-actions">
        <button
          type="button"
          className="admin-settings__save"
          disabled={busy !== null}
          onClick={() => void submit('dining')}
        >
          {busy === 'dining' ? '保存中…' : '保存食堂范围'}
        </button>
        <button
          type="button"
          className="admin-settings__save admin-settings__save--secondary"
          disabled={busy !== null}
          onClick={() => void submit('crowd')}
        >
          {busy === 'crowd' ? '保存中…' : '保存提醒阈值'}
        </button>
        <button
          type="button"
          className="admin-settings__cancel"
          disabled={busy !== null}
          onClick={closeEditor}
        >
          取消编辑
        </button>
      </div>
    </div>
  );
}