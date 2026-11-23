export interface AiProviderOption {
  value: string;
  label: string;
  mode: "preset" | "custom" | "ollama";
  defaultBaseUrl: string;
  recommended?: string;
}

export const aiProviders: AiProviderOption[] = [
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
    label: "Ollama（本地）",
    mode: "ollama",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
  },
  {
    value: "custom",
    label: "自定义服务（OpenAI 兼容）",
    mode: "custom",
    defaultBaseUrl: "",
  },
];

export function resolveAiProvider(id: string): AiProviderOption {
  return (
    aiProviders.find((provider) => provider.value === id) ?? aiProviders[0]
  );
}

export const providerSelectOptions = aiProviders.map((provider) => ({
  value: provider.value,
  label: provider.label,
  hint: provider.mode === "preset" ? "官方预设" : undefined,
}));
