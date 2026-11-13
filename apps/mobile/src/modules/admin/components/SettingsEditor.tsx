import { useState } from 'react';
import { createRequestId } from '../../../shared';
import type { AdminSettings } from '../types';
import type { AdminSourceMode } from '../data/source';

interface SettingsDraftForm {
  name: string;
  radiusMeters: string;
  accuracyToleranceMeters: string;
  crowdedAt: string;
}

interface SettingsDraftPayloads {
  dining: {
    canteenId: string;
    name: string;
    center: { latitude: number; longitude: number };
    radiusMeters: number;
    accuracyToleranceMeters: number;
    demo: boolean;
  };
  crowd: {
    crowdedAt: number;
    demo: boolean;
  };
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateDraft(
  form: SettingsDraftForm,
  settings: AdminSettings,
): { error: string | null; payloads: SettingsDraftPayloads | null } {
  const name = form.name.trim();
  if (name.length === 0 || name.length > 120) {
    return { error: '食堂名称必须为 1—120 个字符。', payloads: null };
  }
  const radiusMeters = parseInteger(form.radiusMeters);
  if (radiusMeters === null || radiusMeters < 1 || radiusMeters > 5000) {
    return { error: '范围半径必须是 1—5000 的整数（米）。', payloads: null };
  }
  const accuracyToleranceMeters = parseInteger(form.accuracyToleranceMeters);
  if (accuracyToleranceMeters === null || accuracyToleranceMeters < 0 || accuracyToleranceMeters > 500) {
    return { error: '误差容忍必须是 0—500 的整数（米）。', payloads: null };
  }
  const crowdedAt = parseInteger(form.crowdedAt);
  if (crowdedAt === null || crowdedAt < 1 || crowdedAt > 1000) {
    return { error: '当前参考阈值必须是 1—1000 的整数（人）。', payloads: null };
  }
  return {
    error: null,
    payloads: {
      dining: {
        canteenId: settings.dining.canteenId,
        name,
        center: settings.dining.center,
        radiusMeters,
        accuracyToleranceMeters,
        demo: settings.dining.demo,
      },
      crowd: {
        crowdedAt,
        demo: settings.crowd.demo,
      },
    },
  };
}

interface SettingsEditorProps {
  mode: AdminSourceMode;
  settings: AdminSettings;
}

export default function SettingsEditor({ mode, settings }: SettingsEditorProps) {
  const [form, setForm] = useState<SettingsDraftForm | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function startEdit() {
    setForm({
      name: settings.dining.name,
      radiusMeters: String(settings.dining.radiusMeters),
      accuracyToleranceMeters: String(settings.dining.accuracyToleranceMeters),
      crowdedAt: String(settings.crowd.crowdedAt),
    });
    setRequestId(createRequestId('admin-settings'));
    setValidationError(null);
    setNotice(null);
    setSubmitted(false);
  }

  function cancelEdit() {
    setForm(null);
    setRequestId(null);
    setValidationError(null);
    setNotice(null);
    setSubmitted(false);
  }

  function updateField(field: keyof SettingsDraftForm, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setRequestId(createRequestId('admin-settings'));
    setValidationError(null);
    setNotice(null);
    setSubmitted(false);
  }

  function saveDraft() {
    if (!form || !requestId) {
      return;
    }
    const result = validateDraft(form, settings);
    if (result.error || !result.payloads) {
      setValidationError(result.error);
      setNotice(null);
      return;
    }
    setSubmitted(true);
    setValidationError(null);
    const payloads = result.payloads;
    const sections = [
      `dining（name=${payloads.dining.name}，radiusMeters=${payloads.dining.radiusMeters}，accuracyToleranceMeters=${payloads.dining.accuracyToleranceMeters}）`,
      `crowd（crowdedAt=${payloads.crowd.crowdedAt}）`,
    ].join('；');
    setNotice(
      mode === 'sample'
        ? `样例模式：这里将调用 PUT /admin/settings（${sections}；requestId=${requestId}；expectedVersion dining ${settings.dining.version} / crowd ${settings.crowd.version}），当前不写入服务端。刷新后恢复原值。`
        : `真实模式 S4 仍为只读：不会发送 PUT（${sections}；requestId=${requestId}；expectedVersion dining ${settings.dining.version} / crowd ${settings.crowd.version}）。S5 接入后按同一 requestId 提交，冲突时保留输入。`,
    );
  }

  return (
    <div className="admin-section">
      <h3>配置编辑（S4 草稿骨架）</h3>
      <p className="admin-muted">
        可编辑白名单：dining 的 name、radiusMeters、accuracyToleranceMeters 与 crowd 的 crowdedAt。
        中心点不在此页编辑，保存时按服务端读取值原样回传；canteenId、demo 与 version 不可改。
        当前保存只生成草稿提示，不发送 PUT，也不显示“已保存”。
      </p>

      {!form ? (
        <div className="admin-form__actions">
          <button type="button" className="admin-action" onClick={startEdit}>
            编辑配置草稿
          </button>
          <span className="admin-muted">样式与校验已就位；S5 接真实保存与版本冲突。</span>
        </div>
      ) : (
        <form
          className="admin-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            saveDraft();
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
            {requestId ? `草稿 requestId：${requestId}` : null}
            {' · '}
            expectedVersion：dining {settings.dining.version} / crowd {settings.crowd.version}
            {' · '}修改任一字段会重新生成 requestId；内容不变的重复提交复用同一 requestId。
          </p>

          {validationError ? (
            <p className="admin-form__error" role="alert">
              {validationError}
            </p>
          ) : null}

          <div className="admin-form__actions">
            <button type="submit" className="admin-action" disabled={submitted}>
              {submitted ? '草稿已生成（不会写入服务端）' : '生成保存草稿'}
            </button>
            <button type="button" className="admin-action" onClick={cancelEdit}>
              取消编辑
            </button>
          </div>
        </form>
      )}

      {notice ? (
        <div className="notice" role="status">
          <strong>未写入服务端</strong>
          <p>{notice}</p>
        </div>
      ) : null}

      <p className="admin-muted">
        S5 冲突处理：服务端返回 SETTING_VERSION_CONFLICT 时显示“配置已被他人修改，请刷新后重试”，保留当前输入，不自动覆盖；
        校验失败时逐项说明半径、误差容忍或阈值问题。
      </p>
    </div>
  );
}