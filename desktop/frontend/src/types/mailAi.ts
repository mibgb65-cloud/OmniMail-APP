import type { SourceLanguage } from "../components/mail/translation/translationLanguages";

export type DraftTarget = "original" | "zh-CN" | "en";
export type DraftTone = "formal" | "friendly";

export type MailAiAction =
  | { kind: "summary"; sourceLanguage: SourceLanguage; forceRefresh?: boolean }
  | {
      kind: "draft";
      sourceLanguage: SourceLanguage;
      targetLanguage: DraftTarget;
      tone: DraftTone;
    }
  | { kind: "chat"; question: string };
