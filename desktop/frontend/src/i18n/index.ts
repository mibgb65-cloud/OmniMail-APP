import { useCallback, useSyncExternalStore } from "react";
import type { LanguageCode } from "../types/settings.ts";
import { enUS } from "./enUS.ts";
import {
  formatLocalizedTime,
  formatMonthName,
  formatUnixTimestamp,
  interpolate,
  plural,
  type TemplateParams,
} from "./formatters.ts";
import {
  isSyncLabelActive,
  isSyncLabelBlocked,
  isSyncLabelHealthy,
  localizeBuiltinText,
  localizeContactGroup,
  localizeSecurityWarning,
} from "./normalizers.ts";
import {
  zhCN,
  type MessageDomain,
  type Messages,
  type TranslationKey,
} from "./zhCN.ts";

export { getLegalDoc, getShortcutGroups } from "./docsAndShortcutsEn.ts";
export {
  enUS,
  formatLocalizedTime,
  formatMonthName,
  formatUnixTimestamp,
  interpolate,
  isSyncLabelActive,
  isSyncLabelBlocked,
  isSyncLabelHealthy,
  localizeBuiltinText,
  localizeContactGroup,
  localizeSecurityWarning,
  plural,
  zhCN,
};
export { localizeProviderPreset } from "./providerCatalogEn.ts";
export type { MessageDomain, Messages, TemplateParams, TranslationKey };

export const LANG_STORAGE_KEY = "omnimail:lang";

export function normalizeLanguage(raw: unknown): LanguageCode {
  return raw === "en-US" ? "en-US" : "zh-CN";
}

export function readStoredLanguage(): LanguageCode {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "en-US" || saved === "zh-CN") return saved;
    } catch {
      // 忽略受限存储环境异常
    }
  }
  if (typeof document !== "undefined") {
    const docLang = document.documentElement.lang;
    if (docLang === "en-US" || docLang === "zh-CN") return docLang;
  }
  return "zh-CN";
}

let currentLang: LanguageCode = readStoredLanguage();
const listeners = new Set<() => void>();

export function getCurrentLanguage(): LanguageCode {
  return currentLang;
}

export function syncHtmlLang(lang: LanguageCode) {
  if (typeof document !== "undefined") {
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang;
    }
  }
}

export function persistLocalLanguage(lang: LanguageCode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // 忽略受限存储环境异常
  }
}

export function setCurrentLanguage(next: LanguageCode, persistLocal = false) {
  const normalized = normalizeLanguage(next);
  syncHtmlLang(normalized);
  if (persistLocal) persistLocalLanguage(normalized);
  if (currentLang === normalized) return;
  currentLang = normalized;
  listeners.forEach((fn) => fn());
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMessages(lang: LanguageCode = currentLang): Messages {
  return lang === "en-US" ? enUS : zhCN;
}

export function translateWithLang(
  lang: LanguageCode,
  key: TranslationKey,
  params?: TemplateParams,
): string {
  const dict = getMessages(lang);
  const dotIdx = key.indexOf(".");
  const domain = key.slice(0, dotIdx) as MessageDomain;
  const subKey = key.slice(dotIdx + 1);
  const bucket = dict[domain] as Record<string, string> | undefined;
  const template = bucket?.[subKey] ?? key;
  return interpolate(template, params);
}

export function t(key: TranslationKey, params?: TemplateParams): string {
  return translateWithLang(currentLang, key, params);
}

export function useI18n() {
  const lang = useSyncExternalStore(
    subscribeLanguage,
    getCurrentLanguage,
    () => "zh-CN" as LanguageCode,
  );
  const translate = useCallback(
    (key: TranslationKey, params?: TemplateParams) =>
      translateWithLang(lang, key, params),
    [lang],
  );
  const formatPlural = useCallback(
    (count: number, singular: string, pluralForm?: string) =>
      plural(lang, count, singular, pluralForm),
    [lang],
  );
  const formatTime = useCallback(
    (raw: string) => formatLocalizedTime(raw, lang),
    [lang],
  );
  const localizeText = useCallback(
    (raw: string) => localizeBuiltinText(raw, lang),
    [lang],
  );
  const localizeGroup = useCallback(
    (group: string) => localizeContactGroup(group, lang),
    [lang],
  );

  return {
    lang,
    isEn: lang === "en-US",
    messages: getMessages(lang),
    t: translate,
    plural: formatPlural,
    formatTime,
    localizeText,
    localizeGroup,
  };
}
