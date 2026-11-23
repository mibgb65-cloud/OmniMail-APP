import {
  isLanguage,
  type SourceLanguage,
} from "../mail/translation/translationLanguages";

export function analysisPrompt(
  kind: "initial" | "formal" | "friendly",
  source: SourceLanguage = "auto",
) {
  return `__ANALYZE__:${kind}:${source}`;
}

export function parseAnalysisPrompt(prompt: string) {
  const match = /^__ANALYZE__:(initial|formal|friendly):([A-Za-z-]+)$/.exec(
    prompt,
  );
  if (!match) return null;
  return {
    forceRefresh: match[1] !== "initial",
    tone: match[1] === "friendly" ? "friendly" : "formal",
    sourceLanguage: isLanguage(match[2]) ? match[2] : "auto",
  };
}
