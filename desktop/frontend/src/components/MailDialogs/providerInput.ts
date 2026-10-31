import type { AddAccountInput, ProviderPreset } from '../../lib/bridge/mail';
import { normalizeAccountEmail } from './providerDetection';

export const isNeteaseProvider = (code: string | null) =>
  code === 'netease_163' || code === 'netease_126';

export function resolveProviderInput(input: AddAccountInput, presets: ProviderPreset[]) {
  if (!isNeteaseProvider(input.providerCode)) return input;
  const email = normalizeAccountEmail(input.email);
  if (!email) return undefined;
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const code =
    domain === '163.com' ? 'netease_163' : domain === '126.com' ? 'netease_126' : undefined;
  const preset = presets.find((value) => value.code === code);
  const incoming = preset?.endpoints?.find((endpoint) => endpoint.protocol === 'imap');
  const outgoing = preset?.endpoints?.find((endpoint) => endpoint.protocol === 'smtp');
  if (!preset || !incoming || !outgoing) return undefined;
  // 展示同一品牌，但每个账号仍使用桥接提供的真实子预设；不改写旧账号或共用上一行的服务器。
  return {
    ...input,
    providerCode: preset.code,
    email,
    imap: {
      ...input.imap,
      host: incoming.host,
      port: incoming.port,
      tlsMode: incoming.tlsMode,
      username: email,
    },
    smtp: {
      ...input.smtp,
      host: outgoing.host,
      port: outgoing.port,
      tlsMode: outgoing.tlsMode,
      username: email,
    },
  };
}
