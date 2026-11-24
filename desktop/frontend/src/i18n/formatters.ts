import type { LanguageCode } from "../types/settings.ts";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type TemplateParams = Record<string, string | number | undefined>;

export function interpolate(template: string, params?: TemplateParams): string {
  if (!params) return template;
  const withPlurals = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\}/g,
    (_, key: string, one: string, other: string) => {
      const raw = params[key];
      const num = typeof raw === "number" ? raw : Number(raw ?? 0);
      const chosen = num === 1 ? one : other;
      return chosen.replace(/#/g, String(raw ?? 0));
    },
  );
  return withPlurals.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val === undefined ? "" : String(val);
  });
}

export function plural(
  lang: LanguageCode,
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  if (lang === "en-US") {
    return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
  }
  return `${count} ${pluralForm ?? singular}`;
}

export function formatMonthName(
  monthIndex0: number,
  lang: LanguageCode,
  long = false,
): string {
  const safe = ((monthIndex0 % 12) + 12) % 12;
  if (lang === "en-US") {
    return long ? MONTHS_LONG[safe] : MONTHS_SHORT[safe];
  }
  return String(safe + 1);
}

function formatMonthDay(
  month1: number,
  day: number,
  time: string | undefined,
  lang: LanguageCode,
  year?: number,
): string {
  const mIdx = Math.max(0, Math.min(11, month1 - 1));
  const curYear = new Date().getFullYear();
  if (lang === "en-US") {
    const mon = MONTHS_SHORT[mIdx];
    if (year && year !== curYear) {
      return `${mon} ${day}, ${year}${time ? ` ${time}` : ""}`;
    }
    return `${mon} ${day}${time ? `, ${time}` : ""}`;
  }
  const yPart = year && year !== curYear ? `${year}年` : "";
  return `${yPart}${month1}月${day}日${time ? ` ${time}` : ""}`;
}

export function formatLocalizedTime(raw: string, lang: LanguageCode): string {
  const s = raw.trim();
  if (!s) return "";
  const isEn = lang === "en-US";
  if (s === "刚刚" || s === "Just now") return isEn ? "Just now" : "刚刚";
  if (s === "今天" || s === "Today") return isEn ? "Today" : "今天";
  if (s === "昨天" || s === "Yesterday") return isEn ? "Yesterday" : "昨天";
  if (s === "尚未同步" || s === "Never") return isEn ? "Never" : "尚未同步";
  if (s === "暂无往来" || s === "No messages yet") {
    return isEn ? "No messages yet" : "暂无往来";
  }

  const yday = s.match(/^(?:昨天|Yesterday)\s+(\d{1,2}:\d{2})$/i);
  if (yday) return isEn ? `Yesterday ${yday[1]}` : `昨天 ${yday[1]}`;

  const mins = s.match(/^(\d+)\s*分钟前$/);
  if (mins) return isEn ? `${mins[1]}m ago` : `${mins[1]} 分钟前`;

  const cnMd = s.match(
    /^(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s+(\d{1,2}:\d{2}))?$/,
  );
  if (cnMd) {
    return formatMonthDay(
      Number(cnMd[2]),
      Number(cnMd[3]),
      cnMd[4],
      lang,
      cnMd[1] ? Number(cnMd[1]) : undefined,
    );
  }

  const dashMd = s.match(/^(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?$/);
  if (dashMd) {
    return formatMonthDay(
      Number(dashMd[1]),
      Number(dashMd[2]),
      dashMd[3],
      lang,
    );
  }

  const fullIso = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/);
  if (fullIso) {
    return formatMonthDay(
      Number(fullIso[2]),
      Number(fullIso[3]),
      fullIso[4],
      lang,
      Number(fullIso[1]),
    );
  }

  return raw;
}

export function formatUnixTimestamp(
  unixMs: number,
  lang: LanguageCode,
  includeTime = true,
): string {
  if (!Number.isFinite(unixMs) || unixMs <= 0) return "";
  const d = new Date(unixMs);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diffDays = Math.floor((d.getTime() - startOfToday) / 86400000);
  if (diffDays === 0) {
    return includeTime ? hm : lang === "en-US" ? "Today" : "今天";
  }
  if (diffDays === -1) {
    const word = lang === "en-US" ? "Yesterday" : "昨天";
    return includeTime ? `${word} ${hm}` : word;
  }
  return formatMonthDay(
    d.getMonth() + 1,
    d.getDate(),
    includeTime ? hm : undefined,
    lang,
    d.getFullYear(),
  );
}
