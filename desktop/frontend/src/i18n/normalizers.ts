import type { LanguageCode } from "../types/settings.ts";

const BUILTIN_GROUP_EN: Record<string, string> = {
  核心项目组: "Core Team",
  设计评审: "Design Review",
  财务与法务: "Finance & Legal",
  外部供应商: "External Vendors",
};

const BUILTIN_TEXT_EN: Record<string, string> = {
  个人工作空间: "Personal Workspace",
  个: "P",
  未填写公司: "No company",
  联系人: "Contact",
  通讯录: "Directory",
  "（无主题）": "(No subject)",
  "（此邮件无正文内容）": "(No message body)",
  待回复: "Reply needed",
  所有邮箱已同步: "All accounts synced",
  "正在同步…": "Syncing…",
  同步部分受阻: "Sync partially blocked",
  首次同步即将开始: "Starting initial sync…",
  预览: "Preview",
};

export function localizeContactGroup(
  group: string,
  lang: LanguageCode,
): string {
  if (lang !== "en-US") return group;
  return BUILTIN_GROUP_EN[group] ?? group;
}

export function localizeBuiltinText(raw: string, lang: LanguageCode): string {
  if (!raw) return raw;
  if (lang !== "en-US") return raw;
  if (BUILTIN_TEXT_EN[raw]) return BUILTIN_TEXT_EN[raw];
  if (BUILTIN_GROUP_EN[raw]) return BUILTIN_GROUP_EN[raw];

  const syncMatch = raw.match(
    /^(?:正在同步|Syncing)\s+(\d+)\s*(?:个邮箱|accounts?)…$/i,
  );
  if (syncMatch) {
    const n = Number(syncMatch[1]);
    return `Syncing ${n} ${n === 1 ? "account" : "accounts"}…`;
  }
  const snoozeMatch = raw.match(/^提醒：(.+)$/);
  if (snoozeMatch) return `Snoozed · ${snoozeMatch[1]}`;
  const meetMatch = raw.match(/^会议 · (.+)$/);
  if (meetMatch) {
    const map: Record<string, string> = {
      已接受: "Accepted",
      暂定: "Tentative",
      已拒绝: "Declined",
    };
    return `Meeting · ${map[meetMatch[1]] ?? meetMatch[1]}`;
  }
  const schedMatch = raw.match(/^定时 · (.+)$/);
  if (schedMatch) return `Scheduled · ${schedMatch[1]}`;
  return raw;
}

export function isSyncLabelActive(syncLabel: string): boolean {
  return (
    syncLabel.startsWith("正在同步") ||
    syncLabel.toLowerCase().startsWith("syncing")
  );
}

export function isSyncLabelHealthy(syncLabel: string): boolean {
  return syncLabel === "所有邮箱已同步" || syncLabel === "All accounts synced";
}

export function isSyncLabelBlocked(syncLabel: string): boolean {
  return syncLabel === "同步部分受阻" || syncLabel === "Sync partially blocked";
}

function translateSecurityClause(clause: string): string {
  if (clause.includes("发件域身份认证未通过")) {
    return "Sender domain authentication failed (DMARC / SPF+DKIM), indicating likely spoofing";
  }
  if (clause.includes("部分发件服务器签名校验未通过")) {
    return "Partial sender authentication check failed — verify sender identity before acting";
  }
  const spoof = clause.match(/发件人显示名伪装为其他域名邮箱（([^）]+)）/);
  if (spoof) {
    return `Display name impersonates another domain (${spoof[1]}) that does not match the actual sender`;
  }
  if (clause.includes("Punycode")) {
    return "Detected Punycode (xn--) lookalike domain — watch out for brand impersonation";
  }
  const replyTo = clause.match(/回复地址域名（([^）]+)）与发件人域名不一致/);
  if (replyTo) {
    return `Reply-To domain (${replyTo[1]}) differs from the sender domain`;
  }
  const anchor = clause.match(
    /正文链接显示为\s+(\S+)，实际指向可疑域名\s+(\S+)/,
  );
  if (anchor) {
    return `Link text displays ${anchor[1]} but points to ${anchor[2]}`;
  }
  const ext = clause.match(/包含高危可执行或脚本附件（\.([^）]+)）/);
  if (ext) {
    return `Contains high-risk executable or script attachment (.${ext[1]}) — do not run blindly`;
  }
  const dbl = clause.match(/检测到双扩展名伪装附件（([^）]+)）/);
  if (dbl) {
    return `Detected disguised double-extension attachment (${dbl[1]})`;
  }
  return clause;
}

export function localizeSecurityWarning(
  warning: { level: "warning" | "danger"; title: string; detail: string },
  lang: LanguageCode,
): { title: string; detail: string } {
  if (lang !== "en-US") {
    return { title: warning.title, detail: warning.detail };
  }
  const title =
    warning.level === "danger"
      ? "High-risk phishing warning"
      : "Verify sender & links";
  const clean = warning.detail.trim().replace(/[。.]+$/, "");
  if (!clean) return { title, detail: warning.detail };
  const parts = clean
    .split("；")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(translateSecurityClause);
  return { title, detail: `${parts.join("; ")}.` };
}
