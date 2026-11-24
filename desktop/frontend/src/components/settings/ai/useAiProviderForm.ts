import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { aiApi, parseBackendError } from "../../../services/backendClient";
import type { AppSettings } from "../../../types/settings";
import type { AiProviderOption } from "./providerOptions";

type Action = "fetch" | "test" | "save" | "clear";

export function useAiProviderForm(
  provider: AiProviderOption,
  settings: AppSettings,
  applySettings: (patch: Partial<AppSettings>) => void,
) {
  const { t } = useI18n();
  const preset = provider.mode === "preset";
  const saved = settings.aiProvider === provider.value ? settings : null;
  const [draftBase, setDraftBase] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [feedback, setFeedback] = useState<{
    error: boolean;
    message: string;
  }>();
  const [keyRevision, setKeyRevision] = useState(0);
  const [keyState, setKeyState] = useState<{ baseUrl: string; mask: string }>();
  const current = useRef(false);

  const baseUrl = preset
    ? provider.defaultBaseUrl
    : (draftBase ?? saved?.aiBaseUrl ?? provider.defaultBaseUrl);
  const model =
    draftModel ??
    (!preset || saved?.aiApiKeyMasked ? (saved?.aiModel ?? "") : "");
  const keyMask =
    keyState?.baseUrl === baseUrl
      ? keyState.mask
      : (preset || baseUrl === saved?.aiBaseUrl ? saved?.aiApiKeyMasked : "") ||
        "";

  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void aiApi
        .getApiKeyMask(provider.value, baseUrl)
        .then((mask) => {
          if (active) setKeyState({ baseUrl, mask });
        })
        .catch(() => {
          if (active) setKeyState({ baseUrl, mask: "" });
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [provider.value, baseUrl, keyRevision]);

  function resetDiscovery() {
    setModels(null);
    setFetchError("");
    setFeedback(undefined);
  }

  function changeBase(next: string) {
    setDraftBase(next);
    setApiKey("");
    resetDiscovery();
  }

  function changeKey(next: string) {
    setApiKey(next);
    resetDiscovery();
  }

  function changeModel(next: string) {
    setDraftModel(next);
    setFeedback(undefined);
  }

  const request = {
    provider: provider.value,
    baseUrl: preset ? "" : baseUrl.trim(),
    model: model.trim(),
    apiKey: apiKey.trim() || undefined,
  };
  const canFetch =
    (provider.mode !== "custom" || Boolean(request.baseUrl)) &&
    (!preset || Boolean(request.apiKey || keyMask));
  const canSaveOrTest =
    canFetch &&
    Boolean(request.model) &&
    (!preset || !request.apiKey || Boolean(models?.includes(request.model)));

  async function run(action: Action) {
    setBusy(action);
    setFeedback(undefined);
    if (action === "fetch") setFetchError("");
    try {
      switch (action) {
        case "fetch": {
          const list = await aiApi.fetchModels({
            provider: request.provider,
            baseUrl: request.baseUrl,
            apiKey: request.apiKey,
          });
          if (!current.current) return;
          setModels(list);
          if (
            !list.includes(request.model) &&
            (preset || (provider.mode === "ollama" && !request.model))
          ) {
            const recommended = provider.recommended;
            setDraftModel(
              recommended && list.includes(recommended)
                ? recommended
                : (list[0] ?? ""),
            );
          }
          break;
        }
        case "test": {
          const result = await aiApi.testConnection(request);
          if (current.current)
            setFeedback({ error: !result.ok, message: result.message });
          break;
        }
        case "save":
        case "clear": {
          const next =
            action === "save"
              ? await aiApi.saveProviderConfig(request)
              : await aiApi.clearApiKey(request.provider, request.baseUrl);
          if (!current.current) return;
          // 只同步由此表单管理的字段，不覆盖正在编辑的其他设置。
          applySettings({
            aiProvider: next.aiProvider,
            aiModel: next.aiModel,
            aiBaseUrl: next.aiBaseUrl,
            aiApiKeyMasked: next.aiApiKeyMasked,
          });
          setApiKey("");
          setKeyState(undefined);
          setKeyRevision((revision) => revision + 1);
          if (action === "clear") resetDiscovery();
          setFeedback({
            error: false,
            message:
              action === "save"
                ? t("settings.aiConfigSavedMsg")
                : t("settings.aiKeyClearedMsg"),
          });
          break;
        }
      }
    } catch (err) {
      if (!current.current) return;
      const message = parseBackendError(err).message;
      if (action === "fetch") setFetchError(message);
      else setFeedback({ error: true, message });
    } finally {
      if (current.current) setBusy(null);
    }
  }

  return {
    baseUrl,
    model,
    apiKey,
    keyMask,
    models,
    busy,
    feedback,
    fetchError,
    canFetch,
    canSaveOrTest,
    changeBase,
    changeKey,
    changeModel,
    run,
  };
}

export type AiProviderForm = ReturnType<typeof useAiProviderForm>;
