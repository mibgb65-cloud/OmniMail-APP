import { isLanguage } from "./translationLanguages";
import type { TranslationOptions } from "./translationTypes";

export type TranslationPreferences = Pick<
  TranslationOptions,
  "target" | "mode" | "includeSubject"
>;

export function readTranslationPreferences(
  key: string,
  englishUI: boolean,
): TranslationPreferences {
  const defaults: TranslationPreferences = {
    target: englishUI ? "en" : "zh-CN",
    mode: "translated",
    includeSubject: false,
  };
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? "null");
    return {
      target: isLanguage(data?.target) ? data.target : defaults.target,
      mode: data?.mode === "bilingual" ? "bilingual" : "translated",
      includeSubject: data?.includeSubject === true,
    };
  } catch {
    return defaults;
  }
}
