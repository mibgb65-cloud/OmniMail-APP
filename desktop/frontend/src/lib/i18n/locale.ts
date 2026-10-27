import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './resources';

export const LOCALE_STORAGE_KEY = 'omnimail.locale';

export function isLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export function detectLocale(languages: readonly unknown[]): Locale {
  for (const language of languages) {
    if (typeof language !== 'string' || language.length === 0 || language.length > 64) continue;
    let base: string;
    try {
      base = new Intl.Locale(language).language;
    } catch {
      // 使用平台的 BCP 47 校验，不把损坏或恶意的系统语言值带入资源选择。
      continue;
    }
    if (base === 'zh') return 'zh-CN';
    if (base === 'en') return 'en';
  }
  return DEFAULT_LOCALE;
}

export function readInitialLocale(): Locale {
  const detected = detectLocale(
    navigator.languages.length > 0 ? navigator.languages : [navigator.language],
  );
  try {
    const stored: unknown = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : detected;
  } catch {
    // WebView 的存储策略可能禁止访问；语言偏好不可用时仍可正常启动。
    return detected;
  }
}

export function persistLocale(locale: Locale): boolean {
  if (!isLocale(locale)) return false;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    // 保留当前会话的选择，不把存储异常或底层诊断信息展示给用户。
    return false;
  }
}
