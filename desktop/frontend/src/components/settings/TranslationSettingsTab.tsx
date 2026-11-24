import { useState } from "react";
import { useI18n } from "../../i18n";
import { parseBackendError, profileApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { AppSettings } from "../../types/settings";
import { CustomSelect, type CustomSelectOption } from "../common/CustomSelect";
import { useTranslation } from "../mail/translation/TranslationContext";
import {
  getLanguages,
  isLanguage,
} from "../mail/translation/translationLanguages";
import { getTranslationModes } from "../mail/translation/translationTypes";
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
  const { lang, t } = useI18n();
  const { preferences, savePreferences } = useTranslation();
  const { settings } = workspace;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const targetLanguageOptions: CustomSelectOption[] = Object.entries(
    getLanguages(lang),
  ).map(([code, name]) => ({
    value: code,
    label: `${name} (${code})`,
  }));

  const displayModeOptions: CustomSelectOption[] = getTranslationModes(t)
    .filter((m) => m.id !== "original")
    .map((m) =>
      m.id === "translated"
        ? {
            value: m.id,
            label: m.option,
            sublabel: t("settings.transModeInlineSub"),
            hint: t("settings.defaultHint"),
          }
        : {
            value: m.id,
            label: m.option,
            sublabel: t("settings.transModeBilingualSub"),
          },
    );

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
      setError(parseBackendError(err).message || t("settings.transSaveFailed"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="translation-settings">
      <div className="settings-card">
        <SwitchRow
          heading={t("settings.transEnableTitle")}
          desc={t("settings.transEnableDesc")}
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
        <div className="settings-row">
          <div className="translation-row-copy">
            <div className="translation-row-title">
              {t("settings.transDefaultTargetTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.transDefaultTargetDesc")}
            </div>
          </div>
          <CustomSelect
            ariaLabel={t("settings.transDefaultTargetTitle")}
            searchLabel={t("settings.transSearchLangLabel")}
            minMenuWidth={236}
            value={preferences.target}
            options={targetLanguageOptions}
            onChange={(value) => {
              if (isLanguage(value))
                savePreferences({ ...preferences, target: value });
            }}
          />
        </div>
      </TranslationEngineFields>
      {error && (
        <p className="text-xs" role="alert">
          {error}
        </p>
      )}
      <div className="settings-card">
        <strong>{t("settings.transLayoutBehaviorSection")}</strong>
        <div className="settings-row">
          <div className="translation-row-copy">
            <div className="translation-row-title">
              {t("settings.transDefaultModeTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.transDefaultModeDesc")}
            </div>
          </div>
          <CustomSelect
            ariaLabel={t("settings.transDefaultModeTitle")}
            minMenuWidth={248}
            value={preferences.mode}
            options={displayModeOptions}
            onChange={(value) =>
              savePreferences({
                ...preferences,
                mode: value === "bilingual" ? "bilingual" : "translated",
              })
            }
          />
        </div>
        <SwitchRow
          heading={t("settings.transSyncSubjectTitle")}
          desc={t("settings.transSyncSubjectDesc")}
          checked={preferences.includeSubject}
          onChange={(includeSubject) =>
            savePreferences({ ...preferences, includeSubject })
          }
        />
      </div>
      <div className="settings-card">
        <strong>{t("settings.transPrivacyCacheSection")}</strong>
        <span className="text-xs text-muted">
          {t("settings.transPrivacyCacheDesc")}
        </span>
      </div>
    </div>
  );
}
