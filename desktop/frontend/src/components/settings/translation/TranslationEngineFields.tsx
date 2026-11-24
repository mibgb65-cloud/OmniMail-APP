import { useState, type ReactNode } from "react";
import { INITIAL_SETTINGS } from "../../../data/settingsDefaults";
import { useI18n } from "../../../i18n";
import type { AppSettings } from "../../../types/settings";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../common/CustomSelect";
import type { TranslationSettingsPatch } from "../TranslationSettingsTab";
import { TranslationConnectionTest } from "./TranslationConnectionTest";

export function TranslationEngineFields({
  settings,
  saving,
  save,
  onOpenAi,
  children,
}: {
  settings: AppSettings;
  saving: boolean;
  save: (patch: TranslationSettingsPatch) => Promise<void>;
  onOpenAi: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [endpoint, setEndpoint] = useState(settings.translationEndpoint);
  const [timeout, setTimeoutSec] = useState(
    String(settings.translationTimeoutSec),
  );
  const usesAI = settings.translationProvider === "ai";
  const dirty =
    endpoint.trim() !== settings.translationEndpoint ||
    timeout !== String(settings.translationTimeoutSec);
  const seconds = Number(timeout);
  const canSave =
    endpoint.trim() &&
    Number.isInteger(seconds) &&
    seconds >= 1 &&
    seconds <= 30;
  const initial = INITIAL_SETTINGS.translationEndpoint;

  const providerOptions: CustomSelectOption[] = [
    {
      value: "bilibili",
      label: t("settings.transBilibiliFreeOption"),
      sublabel: t("settings.transNoApiKeySub"),
      hint: t("settings.recommendedHint"),
    },
    {
      value: "ai",
      label: t("settings.transAiByokOption"),
      sublabel: t("settings.transAiByokSub"),
      hint: "BYOK",
    },
  ];

  return (
    <section
      className="settings-card"
      aria-label={t("settings.transEngineSection")}
    >
      <div className="row translation-settings-heading">
        <strong>{t("settings.transEngineSection")}</strong>
        {!usesAI && (
          <span className="pill pill-neutral">
            {t("settings.transNoApiKeyBadge")}
          </span>
        )}
      </div>
      <div className="settings-row">
        <div className="translation-row-copy">
          <div className="translation-row-title">
            {t("settings.transProviderTitle")}
          </div>
          <div className="text-xs text-muted">
            {t("settings.transProviderDesc")}
          </div>
        </div>
        <CustomSelect
          ariaLabel={t("settings.transProviderTitle")}
          disabled={saving}
          minMenuWidth={252}
          value={settings.translationProvider}
          options={providerOptions}
          onChange={(value) => {
            if (value === "ai" || value === "bilibili")
              void save({ translationProvider: value });
          }}
        />
      </div>
      {children}
      {usesAI ? (
        <div className="settings-row">
          <span className="text-sm text-muted">
            {settings.aiEnabled
              ? t("settings.transUsingAiHint")
              : t("settings.transNeedAiHint")}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenAi}
          >
            {t("settings.transConfigureModelBtn")}
          </button>
        </div>
      ) : (
        <form
          className="translation-engine-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && canSave && !saving)
              void save({
                translationEndpoint: endpoint.trim(),
                translationTimeoutSec: seconds,
              });
          }}
        >
          <div className="row-between">
            <label htmlFor="translation-endpoint">
              {t("settings.transEndpointUrl")}
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={
                saving ||
                (endpoint === initial &&
                  settings.translationEndpoint === initial)
              }
              onClick={() => {
                setEndpoint(initial);
                if (settings.translationEndpoint !== initial)
                  void save({ translationEndpoint: initial });
              }}
            >
              {t("settings.transResetDefaultEndpoint")}
            </button>
          </div>
          <input
            id="translation-endpoint"
            className="input"
            type="url"
            value={endpoint}
            maxLength={2048}
            required
            disabled={saving}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <p className="text-xs text-muted translation-setting-note">
            {t("settings.transEndpointNotePrefix")}
            <code>
              https://index-translate.bilibili.com/v1/chat/completions
            </code>
            {t("settings.transEndpointNoteSuffix")}
          </p>
          <label className="row-between">
            <span>{t("settings.transTimeoutLabel")}</span>
            <span className="row">
              <input
                className="input translation-timeout-input"
                type="number"
                min={1}
                max={30}
                step={1}
                required
                aria-label={t("settings.transTimeoutAria")}
                value={timeout}
                disabled={saving}
                onChange={(e) => setTimeoutSec(e.target.value)}
              />
              <span className="text-xs text-muted">
                {t("settings.transTimeoutSuffix")}
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-sm translation-engine-save"
            disabled={!dirty || !canSave || saving}
          >
            {t("settings.transSaveEngineBtn")}
          </button>
        </form>
      )}
      <TranslationConnectionTest
        key={`${settings.translationEnabled}|${settings.aiEnabled}|${settings.aiProvider}|${settings.aiModel}|${settings.aiBaseUrl}`}
        disabled={
          saving ||
          !settings.translationEnabled ||
          (usesAI ? !settings.aiEnabled : dirty)
        }
      />
    </section>
  );
}
