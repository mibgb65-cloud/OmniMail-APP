import { useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import { AsyncActionButton } from "../../common/AsyncActionButton";
import { CustomSelect } from "../../common/CustomSelect";
import { AiProviderFields } from "./AiProviderFields";
import { getProviderSelectOptions, resolveAiProvider } from "./providerOptions";
import { useAiProviderForm } from "./useAiProviderForm";

export function AiProviderCard() {
  const { workspace } = useApp();
  const { t } = useI18n();
  const [providerId, setProviderId] = useState<string | null>(null);
  const provider = resolveAiProvider(
    providerId ?? workspace.settings.aiProvider,
    t,
  );
  return (
    <AiProviderFormCard
      key={provider.value}
      provider={provider}
      onProviderChange={setProviderId}
    />
  );
}

function AiProviderFormCard({
  provider,
  onProviderChange,
}: {
  provider: ReturnType<typeof resolveAiProvider>;
  onProviderChange: (id: string) => void;
}) {
  const { workspace } = useApp();
  const { t } = useI18n();
  const form = useAiProviderForm(
    provider,
    workspace.settings,
    workspace.applySettingsFromBackend,
  );
  const preset = provider.mode === "preset";
  const locked = Boolean(form.busy);
  const badge = preset
    ? form.models?.length
      ? t("settings.aiBadgeModelsLoaded", { count: form.models.length })
      : form.keyMask || form.apiKey.trim()
        ? t("settings.aiBadgePendingFetch")
        : t("settings.aiBadgePendingKey")
    : provider.mode === "ollama"
      ? t("settings.aiBadgeLocalOllama")
      : t("settings.aiBadgeCustomGateway");
  const footerHint = preset
    ? t("settings.aiFooterPresetHint")
    : provider.mode === "ollama"
      ? t("settings.aiFooterOllamaHint")
      : t("settings.aiFooterCustomHint");
  return (
    <section
      className="ai-provider-settings"
      aria-label={t("settings.aiByokSection")}
    >
      <div className="ai-provider-heading">
        <strong>{t("settings.aiByokSection")}</strong>
        <span
          className={`pill ${form.models?.length ? "pill-success" : "pill-accent"}`}
          role="status"
        >
          {badge}
        </span>
      </div>
      <div className="settings-card ai-provider-surface">
        <div className="ai-provider-row">
          <div className="ai-provider-caption">
            <strong>{t("settings.aiProviderLabel")}</strong>
            <span className="text-xs text-muted">
              {preset
                ? t("settings.aiProviderPresetDesc")
                : t("settings.aiProviderCustomDesc")}
            </span>
          </div>
          <div className="ai-provider-choice">
            <CustomSelect
              fullWidth
              ariaLabel={t("settings.aiProviderSelectAria")}
              value={provider.value}
              options={getProviderSelectOptions(t)}
              disabled={form.busy === "save" || form.busy === "clear"}
              onChange={onProviderChange}
            />
          </div>
        </div>
        <AiProviderFields provider={provider} form={form} />
        {form.feedback && (
          <p
            className={`ai-provider-feedback${form.feedback.error ? " error" : ""}`}
            role={form.feedback.error ? "alert" : "status"}
          >
            {form.feedback.message}
          </p>
        )}
        <div className="ai-provider-footer">
          <span className="text-xs text-muted">{footerHint}</span>
          <div className="ai-provider-actions">
            <AsyncActionButton
              size="sm"
              variant="secondary"
              status={form.busy === "test" ? "loading" : "idle"}
              disabled={locked || !form.canSaveOrTest}
              idleIcon="zap"
              idleLabel={t("settings.aiTestConnIdle")}
              loadingLabel={t("settings.aiTestConnLoading")}
              onClick={() => void form.run("test")}
            />
            <AsyncActionButton
              size="sm"
              status={form.busy === "save" ? "loading" : "idle"}
              disabled={locked || !form.canSaveOrTest}
              idleLabel={t("settings.aiSaveConfigIdle")}
              loadingLabel={t("settings.aiSaveConfigLoading")}
              onClick={() => void form.run("save")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
