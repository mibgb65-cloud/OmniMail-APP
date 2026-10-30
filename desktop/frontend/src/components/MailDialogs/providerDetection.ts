import type { ProviderPreset } from '../../lib/bridge/mail';

// 仅匹配当前预设的主域名；未知域名交由用户配置，不推测服务器或进行联网发现。
const PROVIDER_DOMAINS = new Map([
  ['gmail.com', 'gmail'],
  ['qq.com', 'qq'],
  ['163.com', 'netease_163'],
  ['126.com', 'netease_126'],
]);

export function normalizeAccountEmail(value: string): string | null {
  const email = value.trim();
  if (email.length > 254) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    !/^[a-z\d!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z\d!#$%&'*+/=?^_`{|}~-]+)*$/i.test(local) ||
    !domain ||
    !domain.includes('.') ||
    !domain.split('.').every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
  ) {
    return null;
  }
  return email;
}

export function detectEmailProvider(email: string, presets: ProviderPreset[]) {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return undefined;
  const domain = normalized.slice(normalized.indexOf('@') + 1).toLowerCase();
  const code = PROVIDER_DOMAINS.get(domain);
  return presets.find((preset) => preset.code === code) ?? presets.find((p) => p.code === 'custom');
}
