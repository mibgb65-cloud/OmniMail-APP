import { getCurrentLanguage, translateWithLang } from "../../i18n/index.ts";
import type { LanguageCode } from "../../types/settings.ts";

export function mailAiScope(
  includesSubject: boolean,
  lang: LanguageCode = getCurrentLanguage(),
) {
  return {
    short: translateWithLang(
      lang,
      includesSubject ? "ai.scopeSubjectAndBodyShort" : "ai.scopeBodyOnlyShort",
    ),
    mailContent: translateWithLang(
      lang,
      includesSubject
        ? "ai.scopeSubjectAndBodyContent"
        : "ai.scopeBodyOnlyContent",
    ),
    notShared: translateWithLang(lang, "ai.scopeNotShared"),
  };
}
