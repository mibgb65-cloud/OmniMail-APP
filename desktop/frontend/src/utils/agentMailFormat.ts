export interface ParsedMailAddress {
  name: string;
  email: string;
}

const ANGLE_ADDR_RE = /^(.*?)\s*<([^<>@\s]+@[^<>@\s]+)>\s*$/;

/** 解析 `DisplayName <addr@domain>` 或纯邮箱，返回干净展示名与邮箱地址 */
export function parseMailAddressDisplay(raw: string): ParsedMailAddress {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { name: "", email: "" };

  const match = ANGLE_ADDR_RE.exec(trimmed);
  if (match) {
    const cleanEmail = match[2].trim();
    const rawName = match[1]
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .trim();
    if (rawName && rawName.toLowerCase() !== cleanEmail.toLowerCase()) {
      return { name: rawName, email: cleanEmail };
    }
    const local = cleanEmail.split("@")[0] || cleanEmail;
    return { name: local, email: cleanEmail };
  }

  const unquoted = trimmed.replace(/^["'<]+|["'>]+$/g, "").trim();
  if (unquoted.includes("@") && !/\s/.test(unquoted)) {
    const local = unquoted.split("@")[0] || unquoted;
    return { name: local, email: unquoted };
  }
  return { name: unquoted, email: "" };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 将 ISO-8601 时间字符串格式化为列表或详情可读本地时间，避免裸露 T...Z */
export function formatAgentMailTime(
  isoOrDate: string,
  lang: string,
  style: "list" | "detail",
  now: Date = new Date(),
): string {
  const raw = (isoOrDate ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw.replace(/T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?Z?$/i, " $1");
  }

  const isEn = lang === "en-US";
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  if (style === "list") {
    if (isSameCalendarDay(d, now)) {
      return isEn ? `Today ${hm}` : `今天 ${hm}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameCalendarDay(d, yesterday)) {
      return isEn ? "Yesterday" : "昨天";
    }
    if (d.getFullYear() === now.getFullYear()) {
      return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const sameYear = d.getFullYear() === now.getFullYear();
  if (isEn) {
    const monthStr = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(d);
    return `${monthStr}, ${hm}`;
  }
  const md = `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${hm}`;
  return sameYear ? md : `${d.getFullYear()} 年 ${md}`;
}

export function formatAgentClockTime(ms: number, withSeconds = false): string {
  if (!ms || ms <= 0) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return withSeconds ? `${hm}:${pad2(d.getSeconds())}` : hm;
}

/** 精简智能体邮箱标题（默认折叠 WorkBuddy 智能体邮箱 / Muse 独立会话等冗余后缀） */
export function resolveConciseAgentTitle(
  rawName: string | undefined,
  provider: "workbuddy" | "muse",
): string {
  const trimmed = (rawName ?? "").trim();
  const fallback = provider === "workbuddy" ? "WorkBuddy" : "Muse";
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (
    provider === "workbuddy" &&
    (lower === "workbuddy" ||
      lower === "workbuddy agent 邮箱" ||
      lower === "workbuddy 智能体邮箱" ||
      lower === "workbuddy agent mail")
  ) {
    return "WorkBuddy";
  }
  if (
    provider === "muse" &&
    (lower === "muse" ||
      lower === "muse mail" ||
      lower === "muse mail 独立会话" ||
      lower === "muse mail session")
  ) {
    return "Muse";
  }
  return trimmed;
}

export function buildAgentReplySubject(subject: string): string {
  const clean = (subject ?? "").trim().replace(/^re:\s*/i, "");
  return clean ? `Re: ${clean}` : "Re: ";
}
