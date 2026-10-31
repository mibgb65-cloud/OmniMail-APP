import type { Translations } from '../../lib/i18n/resources';

const APP_PASSWORD_PROVIDERS = new Set(['gmail', 'naver', 'yandex', 'icloud', 'yahoo']);
const PROVIDER_HINTS = new Map<string, keyof Translations['mail']>([
  ['gmail', 'googleHint'],
  ['linuxdo', 'linuxdoHint'],
  ['netease_163', 'neteaseHint'],
  ['netease_126', 'neteaseHint'],
  ['naver', 'naverHint'],
  ['yandex', 'yandexHint'],
  ['icloud', 'icloudHint'],
  ['yahoo', 'yahooHint'],
]);

export const usesAppPassword = (code: string | null) => APP_PASSWORD_PROVIDERS.has(code ?? '');
export const providerAuthenticationHint = (code: string | null) => PROVIDER_HINTS.get(code ?? '');
