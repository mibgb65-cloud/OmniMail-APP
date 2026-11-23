import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TranslateMail } from "../../../../bindings/omnimail/services/aiservice";
import { parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import { isWailsDesktop } from "../../../state/storageHelpers";
import { detectMailLanguage, isLanguage } from "./translationLanguages";
import {
  readTranslationPreferences,
  type TranslationPreferences,
} from "./translationPreferences";
import type {
  TranslationMode,
  TranslationOptions,
  TranslationResult,
  TranslatedMode,
} from "./translationTypes";

type Entry = {
  result?: TranslationResult;
  mode?: TranslationMode;
  pending?: boolean;
  error?: string;
};
type ProfileTranslationState = {
  key: string;
  token: object;
  entries: Record<string, Entry>;
  preferences: TranslationPreferences;
};

function useMailTranslations() {
  const { workspace, mailStore } = useApp();
  const mail = mailStore.selectedMail;
  const profileId = workspace.activeProfileId;
  const key = `omnimail.translation.${profileId}`;
  const initialState = (): ProfileTranslationState => ({
    key,
    token: {},
    entries: {},
    preferences: readTranslationPreferences(
      key,
      workspace.settings.language === "en-US",
    ),
  });
  const [saved, setSaved] = useState(initialState);
  const state = saved.key === key ? saved : initialState();
  if (saved !== state) setSaved(state);
  const { entries, preferences, token } = state;
  const id = mail?.id ?? "";
  const entry = Object.prototype.hasOwnProperty.call(entries, id)
    ? entries[id]
    : undefined;
  const result = entry?.result;
  const selectedMessage = mail?.messages.find((m) => m.id === id);
  const detectedLanguage = useMemo(
    () =>
      detectMailLanguage(
        selectedMessage?.bodyParagraphs.join(" ") ||
          mail?.snippet ||
          mail?.subject ||
          "",
      ),
    [selectedMessage, mail?.snippet, mail?.subject],
  );
  const language =
    result && result.content.source !== "auto"
      ? result.content.source
      : detectedLanguage;
  const disabled =
    !workspace.settings.aiEnabled ||
    mail?.folder === "spam" ||
    mail?.folder === "trash" ||
    mail?.securityWarning?.level === "danger";

  const savePreferences = (next: TranslationPreferences) => {
    setSaved((prev) =>
      prev.token === token ? { ...prev, preferences: next } : prev,
    );
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* 本次进程仍可使用。 */
    }
  };
  const patch = (next: Entry) =>
    setSaved((prev) => {
      if (prev.token !== token) return prev;
      // 仅在本次工作空间会话保留译文，限制缓存大小。
      const rest = Object.entries(prev.entries)
        .filter(([mailId]) => mailId !== id)
        .slice(-23);
      return {
        ...prev,
        entries: Object.fromEntries([
          ...rest,
          [id, { ...prev.entries[id], ...next }],
        ]),
      };
    });
  const setMode = (mode: TranslationMode) => {
    if (result)
      patch({
        mode,
        result:
          mode === "original"
            ? result
            : { ...result, options: { ...result.options, mode } },
      });
  };

  const translate = async (options: TranslationOptions) => {
    if (!id || disabled || entry?.pending) return;
    if (
      result &&
      result.options.source === options.source &&
      result.options.target === options.target &&
      result.options.includeSubject === options.includeSubject
    ) {
      patch({
        mode: options.mode,
        result: { ...result, options },
        error: undefined,
      });
      return;
    }
    patch({ pending: true, error: undefined });
    try {
      if (!isWailsDesktop())
        throw new Error("请在 OmniMail 桌面应用中翻译邮件");
      const data = await TranslateMail({
        profileId,
        mailId: id,
        source: options.source,
        target: options.target,
        includeSubject: options.includeSubject,
        consentConfirmed: true,
      });
      const content = {
        source: isLanguage(data.source) ? data.source : ("auto" as const),
        target: options.target,
        subject: data.subject,
        segments: data.segments ?? {},
      };
      patch({
        result: { content, options },
        mode: options.mode,
        pending: false,
      });
    } catch (err) {
      patch({
        pending: false,
        error: parseBackendError(err).message || "翻译失败，原文未改变",
      });
    }
  };
  return {
    mailId: id,
    result,
    language,
    confirmedSource: result?.content.source ?? "auto",
    disabled,
    preferences,
    savePreferences,
    translate,
    setMode,
    pending: Boolean(entry?.pending),
    error: entry?.error,
    mode: entry?.mode ?? ("original" as TranslationMode),
    preferredMode: (result?.options.mode ?? preferences.mode) as TranslatedMode,
  };
}

const TranslationContext = createContext<ReturnType<
  typeof useMailTranslations
> | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const value = useMailTranslations();
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const value = useContext(TranslationContext);
  if (!value) throw new Error("邮件翻译状态未初始化");
  return value;
}
