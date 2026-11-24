import { t as globalT, type TranslationKey } from "../../../i18n";

export interface AiProviderOption {
  value: string;
  label: string;
  mode: "preset" | "custom" | "ollama";
  defaultBaseUrl: string;
  recommended?: string;
}

export function getAiProviders(
  translate: (key: TranslationKey) => string = globalT,
): AiProviderOption[] {
  return [
    {
      value: "openai",
      label: "OpenAI",
      mode: "preset",
      defaultBaseUrl: "https://api.openai.com/v1",
      recommended: "gpt-4.1-mini",
    },
    {
      value: "deepseek",
      label: "DeepSeek",
      mode: "preset",
      defaultBaseUrl: "https://api.deepseek.com/v1",
      recommended: "deepseek-chat",
    },
    {
      value: "claude",
      label: "Anthropic Claude",
      mode: "preset",
      defaultBaseUrl: "https://api.anthropic.com/v1",
    },
    {
      value: "gemini",
      label: "Google Gemini",
      mode: "preset",
      defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      recommended: "gemini-2.5-flash",
    },
    {
      value: "ollama",
      label: translate("settings.aiProviderOllamaLabel"),
      mode: "ollama",
      defaultBaseUrl: "http://127.0.0.1:11434/v1",
    },
    {
      value: "custom",
      label: translate("settings.aiProviderCustomLabel"),
      mode: "custom",
      defaultBaseUrl: "",
    },
  ];
}

export const aiProviders: AiProviderOption[] = getAiProviders();

export function resolveAiProvider(
  id: string,
  translate: (key: TranslationKey) => string = globalT,
): AiProviderOption {
  const list = getAiProviders(translate);
  return list.find((provider) => provider.value === id) ?? list[0];
}

export function getProviderSelectOptions(
  translate: (key: TranslationKey) => string = globalT,
) {
  return getAiProviders(translate).map((provider) => ({
    value: provider.value,
    label: provider.label,
    hint:
      provider.mode === "preset"
        ? translate("settings.aiProviderOfficialHint")
        : undefined,
  }));
}

export const providerSelectOptions = getProviderSelectOptions();
