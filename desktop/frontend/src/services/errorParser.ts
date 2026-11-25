import {
  getCurrentLanguage,
  translateWithLang,
  type TranslationKey,
} from "../i18n/index.ts";
import type { LanguageCode } from "../types/settings.ts";

export interface ParsedBackendError {
  code: string;
  message: string;
}

const ERROR_CODE_KEYS: Record<string, TranslationKey> = {
  ERR_PIN_REQUIRED: "errors.ERR_PIN_REQUIRED",
  ERR_PIN_INVALID: "errors.ERR_PIN_INVALID",
  ERR_AUTH_EXPIRED: "errors.ERR_AUTH_EXPIRED",
  ERR_IDENTITY_LOCKED: "errors.ERR_IDENTITY_LOCKED",
  ERR_UNDO_WINDOW_EXPIRED: "errors.ERR_UNDO_WINDOW_EXPIRED",
  ERR_AI_DISABLED: "errors.ERR_AI_DISABLED",
  ERR_AI_CONSENT_REQUIRED: "errors.ERR_AI_CONSENT_REQUIRED",
  ERR_AI_SENSITIVE_BLOCKED: "errors.ERR_AI_SENSITIVE_BLOCKED",
  ERR_TRANSLATION_FAILED: "errors.ERR_TRANSLATION_FAILED",
  ERR_NETWORK_OFFLINE: "errors.ERR_NETWORK_OFFLINE",
  ERR_DISK_FULL: "errors.ERR_DISK_FULL",
  ERR_INVALID_INPUT: "errors.ERR_INVALID_INPUT",
  ERR_NOT_FOUND: "errors.ERR_NOT_FOUND",
  ERR_CONN_FAILED: "errors.ERR_CONN_FAILED",
  ERR_CERT_UNTRUSTED: "errors.ERR_CERT_UNTRUSTED",
  ERR_INTERNAL: "errors.ERR_INTERNAL",
  ERR_MUSE_NOT_LOGGED_IN: "errors.ERR_MUSE_NOT_LOGGED_IN",
  ERR_MUSE_AUTH_EXPIRED: "errors.ERR_MUSE_AUTH_EXPIRED",
  ERR_MUSE_NOT_ENABLED: "errors.ERR_MUSE_NOT_ENABLED",
  ERR_MUSE_IDENTITY_CHANGED: "errors.ERR_MUSE_IDENTITY_CHANGED",
  ERR_MUSE_GATEWAY_TIMEOUT: "errors.ERR_MUSE_GATEWAY_TIMEOUT",
  ERR_MUSE_GATEWAY_FAILED: "errors.ERR_MUSE_GATEWAY_FAILED",
  ERR_MUSE_UNSUPPORTED: "errors.ERR_MUSE_UNSUPPORTED",
  ERR_MUSE_CANCELLED: "errors.ERR_MUSE_CANCELLED",
};

const UNTAGGED_EN_MAP: Record<string, string> = {
  "模型未返回邮件摘要，请重试":
    "Model returned an empty summary — please retry",
  "请在 OmniMail 桌面应用中配置 AI 服务":
    "Configure AI services in the OmniMail desktop app",
  "请在 OmniMail 桌面应用中翻译邮件":
    "Please translate emails in the OmniMail desktop app",
  "翻译结果无效，请重试": "Invalid translation response — please retry",
};

export function parseBackendError(
  err: unknown,
  lang: LanguageCode = getCurrentLanguage(),
): ParsedBackendError {
  const fallback = translateWithLang(lang, "errors.unknownServiceError");
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const trimmed = raw.trim();
  if (!trimmed) return { code: "", message: fallback };

  const match = /^(?:\[(ERR_[A-Z0-9_]+)\]|(ERR_[A-Z0-9_]+):)\s*(.*)$/.exec(
    trimmed,
  );
  if (match) {
    const code = match[1] ?? match[2] ?? "";
    const detail = match[3]?.trim() ?? "";
    const mappedKey = ERROR_CODE_KEYS[code];
    if (mappedKey && (lang === "en-US" || !detail)) {
      return { code, message: translateWithLang(lang, mappedKey) };
    }
    return { code, message: detail || trimmed };
  }

  if (lang === "en-US" && UNTAGGED_EN_MAP[trimmed]) {
    return { code: "", message: UNTAGGED_EN_MAP[trimmed] };
  }
  return { code: "", message: trimmed };
}
