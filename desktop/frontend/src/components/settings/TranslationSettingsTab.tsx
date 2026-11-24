import { useState } from "react";
import { profileApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { AppSettings } from "../../types/settings";
import { useTranslation } from "../mail/translation/TranslationContext";
import {
  isLanguage,
  languages,
} from "../mail/translation/translationLanguages";
import { SwitchRow } from "./SwitchRow";
import { TranslationEngineFields } from "./translation/TranslationEngineFields";

export type TranslationSettingsPatch = Partial<
  Pick<
    AppSettings,
    | "translationEnabled"
    | "translationProvider"
    | "translationEndpoint"
    | "translationTimeoutSec"
  >
>;

export function TranslationSettingsTab({ onOpenAi }: { onOpenAi: () => void }) {
  const { workspace } = useApp();
  const { preferences, savePreferences } = useTranslation();
  const { settings } = workspace;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (patch: TranslationSettingsPatch) => {
    setSaving(true);
    setError("");
    try {
      const next = await profileApi.updateAppSettings(patch);
      const persisted: TranslationSettingsPatch = { ...patch };
      if (patch.translationEndpoint !== undefined)
        persisted.translationEndpoint = next.translationEndpoint;
      workspace.applySettingsFromBackend(persisted);
    } catch (err) {
      setError(parseBackendError(err).message || "翻译设置未能保存，请重试。");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="translation-settings">
      <div className="settings-card">
        <SwitchRow
          heading="启用邮件翻译"
          desc="按需翻译当前邮件，保留表格、按钮、字号和配色。"
          checked={settings.translationEnabled}
          disabled={saving}
          onChange={(translationEnabled) => void save({ translationEnabled })}
        />
      </div>
      <TranslationEngineFields
        key={JSON.stringify([
          workspace.activeProfileId,
          settings.translationProvider,
          settings.translationEndpoint,
          settings.translationTimeoutSec,
        ])}
        settings={settings}
        saving={saving}
        save={save}
        onOpenAi={onOpenAi}
      >
        <label className="settings-row">
          默认目标语言
          <select
            className="input"
            value={preferences.target}
            onChange={(e) => {
              if (isLanguage(e.target.value))
                savePreferences({ ...preferences, target: e.target.value });
            }}
          >
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </select>
        </label>
      </TranslationEngineFields>
      {error && (
        <p className="text-xs" role="alert">
          {error}
        </p>
      )}
      <div className="settings-card">
        <strong>排版保真与翻译行为</strong>
        <label className="settings-row">
          默认显示模式
          <select
            className="input"
            value={preferences.mode}
            onChange={(e) =>
              savePreferences({
                ...preferences,
                mode:
                  e.target.value === "bilingual" ? "bilingual" : "translated",
              })
            }
          >
            <option value="translated">原地替换译文</option>
            <option value="bilingual">双语对照</option>
          </select>
        </label>
        <SwitchRow
          heading="同步翻译邮件主题"
          desc="关闭时只翻译正文。可在邮件顶部翻译选项中按封调整。"
          checked={preferences.includeSubject}
          onChange={(includeSubject) =>
            savePreferences({ ...preferences, includeSubject })
          }
        />
      </div>
      <div className="settings-card">
        <strong>本地译文缓存与隐私边界</strong>
        <span className="text-xs text-muted">
          仅在点击「开始翻译」后发送可见文字和所选主题，不发送邮件头、图片或附件。
          译文只在当前工作空间会话中缓存。
        </span>
      </div>
    </div>
  );
}
