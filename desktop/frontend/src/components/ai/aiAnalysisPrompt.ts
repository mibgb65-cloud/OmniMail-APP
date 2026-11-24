import type { MailAiAction } from "../../types/mailAi";
import type { SourceLanguage } from "../mail/translation/translationLanguages";

export function summaryAction(
  sourceLanguage: SourceLanguage,
  forceRefresh = false,
): Extract<MailAiAction, { kind: "summary" }> {
  return { kind: "summary", sourceLanguage, forceRefresh };
}

export function originalReplyAction(): Extract<
  MailAiAction,
  { kind: "draft" }
> {
  return {
    kind: "draft",
    sourceLanguage: "auto",
    targetLanguage: "original",
    tone: "formal",
  };
}
