import type { Language, SourceLanguage } from "./translationLanguages";

export const translationModes = [
  { id: "original", label: "原文", option: "恢复原文" },
  { id: "translated", label: "仅译文", option: "原地替换译文" },
  { id: "bilingual", label: "双语对照", option: "双语对照" },
] as const;

export type TranslationMode = (typeof translationModes)[number]["id"];
export type TranslatedMode = Exclude<TranslationMode, "original">;

export interface TranslationOptions {
  source: SourceLanguage;
  target: Language;
  mode: TranslatedMode;
  includeSubject: boolean;
}

export interface MailTranslation {
  source: SourceLanguage;
  target: Language;
  subject: string;
  segments: Record<string, string | undefined>;
}

export interface TranslationResult {
  options: TranslationOptions;
  content: MailTranslation;
}
