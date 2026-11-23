import { franc } from "franc-min";

export const languages = {
  "zh-CN": "简体中文",
  "zh-TW": "繁体中文",
  en: "英语",
  ja: "日语",
  ko: "韩语",
  fr: "法语",
  de: "德语",
  es: "西班牙语",
  pt: "葡萄牙语",
  ru: "俄语",
  it: "意大利语",
  ar: "阿拉伯语",
} as const;

export type Language = keyof typeof languages;
export type SourceLanguage = Language | "auto";
export const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(languages, value);

const codes: Record<string, Language> = {
  cmn: "zh-CN",
  eng: "en",
  jpn: "ja",
  kor: "ko",
  fra: "fr",
  deu: "de",
  spa: "es",
  por: "pt",
  rus: "ru",
  ita: "it",
  arb: "ar",
};

export function detectMailLanguage(text: string): SourceLanguage {
  const sample = text.slice(0, 1600).replace(/https?:\/\/\S+|\S+@\S+/gi, " ");
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(sample)) return "ja";
  if (/\p{Script=Hangul}/u.test(sample)) return "ko";
  if (/\p{Script=Han}/u.test(sample)) return "zh-CN";
  if (/\p{Script=Arabic}/u.test(sample)) return "ar";
  return (
    codes[franc(sample, { only: Object.keys(codes), minLength: 15 })] ?? "auto"
  );
}

export const languageCode = (lang: SourceLanguage) =>
  lang === "auto" ? "AUTO" : lang.startsWith("zh-") ? "ZH" : lang.toUpperCase();
