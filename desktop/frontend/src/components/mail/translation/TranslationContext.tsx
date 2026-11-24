import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useApp } from "../../../state/AppContext";
import { detectMailLanguage } from "./translationLanguages";
import {
  readTranslationPreferences,
  type TranslationPreferences,
} from "./translationPreferences";
import {
  changeTranslationMode,
  type TranslationEntry,
} from "./translationStreamState";
import { updateScopedTranslation } from "./translationSessionCache";
import type { TranslationMode } from "./translationTypes";
import {
  useTranslationRequests,
  type UpdateTranslationEntry,
} from "./useTranslationRequests";

type ProfileTranslationState = {
  scope: string;
  token: object;
  entries: Record<string, TranslationEntry>;
  preferences: TranslationPreferences;
};

function useMailTranslations() {
  const { workspace, mailStore } = useApp();
  const mail = mailStore.selectedMail;
  const profileId = workspace.activeProfileId;
  const key = `omnimail.translation.${profileId}`;
  const { settings } = workspace;
  const usesAI = settings.translationProvider === "ai";
  const providerEnabled =
    settings.translationEnabled && (!usesAI || settings.aiEnabled);
  const scope = JSON.stringify([
    key,
    providerEnabled,
    settings.translationProvider,
    ...(usesAI
      ? [settings.aiProvider, settings.aiBaseUrl, settings.aiModel]
      : [settings.translationEndpoint, settings.translationTimeoutSec]),
  ]);
  const initialState = (): ProfileTranslationState => ({
    scope,
    token: {},
    entries: {},
    preferences: readTranslationPreferences(
      key,
      workspace.settings.language === "en-US",
    ),
  });
  const [saved, setSaved] = useState(initialState);
  const state = saved.scope === scope ? saved : initialState();
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
  const blocked =
    mail?.folder === "spam" ||
    mail?.folder === "trash" ||
    mail?.securityWarning?.level === "danger";
  const disabledReason = !settings.translationEnabled
    ? "邮件翻译已停用，可在翻译设置中开启。"
    : blocked
      ? "此邮件受隐私保护，不发送给翻译引擎。"
      : !providerEnabled
        ? "请启用并配置 AI 模型，或在翻译设置中切换引擎。"
        : "";
  const disabled = !id || Boolean(disabledReason);

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
  const update: UpdateTranslationEntry = (change) =>
    setSaved((prev) => updateScopedTranslation(prev, token, id, change));
  const setMode = (mode: TranslationMode) => {
    update((current) => current && changeTranslationMode(current, mode));
  };
  const translate = useTranslationRequests({
    profileId,
    provider: settings.translationProvider,
    mailId: id,
    token,
    disabled,
    entry,
    update,
  });
  return {
    mailId: id,
    result,
    language,
    confirmedSource: result?.content.source ?? "auto",
    disabled,
    disabledReason,
    engineLabel: usesAI ? "AI 模型" : "内置免费翻译",
    preferences,
    savePreferences,
    translate,
    setMode,
    pending: entry?.phase === "pending",
    partial: entry?.phase === "partial",
    hasTranslation:
      entry?.phase === "partial" || Boolean(entry?.completedBatches),
    failed: entry?.phase === "failed" || entry?.phase === "partial",
    completedBatches: entry?.completedBatches ?? 0,
    totalBatches: entry?.totalBatches ?? 0,
    error: entry?.error,
    mode: entry?.mode ?? ("original" as TranslationMode),
    preferredMode: result?.options.mode ?? preferences.mode,
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
