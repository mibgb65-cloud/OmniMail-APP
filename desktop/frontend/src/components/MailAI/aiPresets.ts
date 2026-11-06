import type { AIConfig, AIConfigInput } from '../../lib/bridge/ai';

export const DEEPSEEK_PRESET = {
  endpoint: 'https://api.deepseek.com',
  model: 'deepseek-flash',
} as const;

export function aiInputFromConfig(config: AIConfig): AIConfigInput {
  // 预设只是首次填写建议；已保存过的空配置也可能是主动停用，不能重新替用户启用。
  const untouched = !config.revision && !config.endpoint && !config.model && !config.hasKey;
  return {
    endpoint: untouched ? DEEPSEEK_PRESET.endpoint : config.endpoint,
    model: untouched ? DEEPSEEK_PRESET.model : config.model,
    language: config.language,
    consent: untouched ? false : config.consent,
    apiKey: '',
    removeKey: false,
  };
}

export function fillDeepSeekInput(input: AIConfigInput): AIConfigInput {
  // 已用官方 /v1 或 :443 时保持原目的地，避免仅填预设就触发旧密钥的跨目的地清理。
  const official = /^https:\/\/api\.deepseek\.com(?::443)?(?:\/v1)?\/?$/i.test(input.endpoint);
  return {
    ...input,
    endpoint: official ? input.endpoint : DEEPSEEK_PRESET.endpoint,
    model: DEEPSEEK_PRESET.model,
    apiKey: '',
    removeKey: false,
    consent: false,
  };
}
