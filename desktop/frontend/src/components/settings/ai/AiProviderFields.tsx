import { useI18n } from "../../../i18n";
import { AsyncActionButton } from "../../common/AsyncActionButton";
import { CustomSelect } from "../../common/CustomSelect";
import { PasswordInput } from "../../common/PasswordInput";
import type { AiProviderOption } from "./providerOptions";
import type { AiProviderForm } from "./useAiProviderForm";

function ListModelsButton({
  form,
  preset,
}: {
  form: AiProviderForm;
  preset: boolean;
}) {
  const { t } = useI18n();
  const label = preset
    ? t("settings.aiFetchModelsPreset")
    : t("settings.aiFetchModelsCustom");
  return (
    <AsyncActionButton
      variant={preset ? "primary" : "secondary"}
      status={form.busy === "fetch" ? "loading" : "idle"}
      disabled={Boolean(form.busy) || !form.canFetch}
      idleIcon="refresh"
      idleLabel={label}
      loadingLabel={t("settings.aiFetchingModels")}
      onClick={() => void form.run("fetch")}
    />
  );
}

export function AiProviderFields({
  provider,
  form,
}: {
  provider: AiProviderOption;
  form: AiProviderForm;
}) {
  const { t } = useI18n();
  const preset = provider.mode === "preset";
  const locked = Boolean(form.busy);
  const modelOptions = (form.models ?? []).map((id) => ({
    value: id,
    label: id,
  }));
  const modelPlaceholder = form.models
    ? t("settings.aiNoModelsFound")
    : t("settings.aiFetchModelsFirst");
  const modelLabel = preset
    ? t("settings.aiChooseModel")
    : t("settings.aiModelName");
  const pickLabel = t("settings.aiPickFetchedModel");
  const customPlaceholder =
    provider.defaultBaseUrl || "https://your-gateway.example.com/v1";
  const keyPlaceholder = preset
    ? t("settings.aiApiKeyPresetPlaceholder", { provider: provider.label })
    : t("settings.aiApiKeyCustomPlaceholder");
  const presetDesc = form.models?.length
    ? t("settings.aiModelsLoadedDesc", {
        provider: provider.label,
        count: form.models.length,
      })
    : form.models
      ? t("settings.aiNoModelsReturnedDesc")
      : form.apiKey.trim() || form.keyMask
        ? t("settings.aiKeyReadyFetchDesc")
        : t("settings.aiEnterKeyFirstDesc");
  const presetOpts = modelOptions.length
    ? modelOptions
    : [{ value: form.model, label: form.model || modelPlaceholder }];
  return (
    <>
      {!preset && (
        <label className="ai-provider-field">
          <span>
            {t("settings.aiCustomBaseUrlLabel")}
            {provider.mode === "custom"
              ? t("settings.aiCustomBaseUrlRequired")
              : ""}
          </span>
          <input
            className="input ai-provider-mono"
            value={form.baseUrl}
            maxLength={2048}
            disabled={locked}
            placeholder={customPlaceholder}
            onChange={(e) => form.changeBase(e.target.value)}
          />
          <span className="text-xs text-muted">
            {t("settings.aiHttpsRequiredHint")}
          </span>
        </label>
      )}
      <div className="ai-provider-field">
        <div className="ai-provider-key-label">
          <span>
            {t("settings.aiApiKeyLabel", {
              optional: !preset ? t("settings.aiOptionalPrefix") : "",
              mask: form.keyMask || t("settings.aiNotSet"),
            })}
          </span>
          {preset && (
            <span className="text-xs text-muted ai-provider-mono">
              {t("settings.aiOfficialEndpointPrefix", {
                host: provider.defaultBaseUrl.replace(/^https:\/\//, ""),
              })}
            </span>
          )}
        </div>
        <div className="ai-provider-input-row">
          <PasswordInput
            value={form.apiKey}
            onChange={form.changeKey}
            disabled={locked}
            maxLength={4096}
            ariaLabel={t("settings.aiApiKeyAria")}
            placeholder={keyPlaceholder}
          />
          {preset && <ListModelsButton form={form} preset />}
        </div>
        {form.keyMask && (
          <button
            type="button"
            className="btn btn-ghost btn-sm ai-provider-clear"
            disabled={locked}
            onClick={() => void form.run("clear")}
          >
            {t("settings.aiClearSavedKey")}
          </button>
        )}
      </div>
      {preset ? (
        <div className="ai-provider-row">
          <div className="ai-provider-caption">
            <strong>{modelLabel}</strong>
            <span className="text-xs text-muted">{presetDesc}</span>
          </div>
          <div className="ai-provider-choice">
            <CustomSelect
              value={form.model}
              fullWidth
              mono
              ariaLabel={modelLabel}
              searchLabel={t("settings.aiSearchModelLabel")}
              options={presetOpts}
              disabled={locked || modelOptions.length === 0}
              onChange={form.changeModel}
            />
          </div>
        </div>
      ) : (
        <div className="ai-provider-field">
          <label htmlFor="ai-manual-model">
            {t("settings.aiManualModelLabel", { label: modelLabel })}
          </label>
          <div className="ai-provider-input-row">
            <input
              id="ai-manual-model"
              className="input ai-provider-mono"
              value={form.model}
              maxLength={256}
              disabled={locked}
              placeholder={t("settings.aiManualModelPlaceholder")}
              onChange={(e) => form.changeModel(e.target.value)}
            />
            <ListModelsButton form={form} preset={false} />
          </div>
          {modelOptions.length > 0 && (
            <CustomSelect
              value={form.model}
              fullWidth
              mono
              disabled={locked}
              ariaLabel={pickLabel}
              searchLabel={t("settings.aiSearchModelLabel")}
              options={
                modelOptions.some((o) => o.value === form.model)
                  ? modelOptions
                  : [{ value: form.model, label: pickLabel }, ...modelOptions]
              }
              onChange={form.changeModel}
            />
          )}
          {form.models?.length === 0 && (
            <span className="text-xs text-muted">
              {t("settings.aiNoModelsManualHint")}
            </span>
          )}
        </div>
      )}
      {form.fetchError && (
        <p className="ai-provider-feedback error" role="alert">
          {form.fetchError}
        </p>
      )}
    </>
  );
}
