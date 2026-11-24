import {
  clearTrustedDomains,
  isDomainTrusted,
  isIpAddressHost,
  listTrustedDomains,
  normalizeHostname,
  removeTrustedDomain,
  trustDomain,
} from "./trustedLinkDomains.ts";

export {
  clearTrustedDomains,
  isDomainTrusted,
  listTrustedDomains,
  removeTrustedDomain,
  trustDomain,
};

export type ExternalLinkRisk = "normal" | "warning" | "danger";

export type ExternalLinkReason =
  "spoofed-text" | "punycode" | "mail-danger" | "ip-address" | "insecure-http";

export interface ExternalLinkInspection {
  fullUrl: string;
  hostname: string;
  protocol: "http:" | "https:";
  displayText: string;
  shownHostname?: string;
  risk: ExternalLinkRisk;
  reasons: ExternalLinkReason[];
  canTrust: boolean;
}

const TWO_PART_SUFFIXES = new Set(
  "ac.uk,co.in,co.jp,co.kr,co.nz,co.uk,com.au,com.br,com.cn,com.hk,com.sg,com.tw,edu.cn,gov.cn,ne.jp,net.cn,or.jp,org.cn,org.uk".split(
    ",",
  ),
);

const NON_DOMAIN_EXTENSIONS = new Set(
  "apk,css,csv,dmg,doc,docx,eml,exe,gif,go,gz,htm,html,ics,java,jpeg,jpg,js,json,md,mov,mp3,mp4,msi,pdf,png,ppt,pptx,py,rar,svg,tar,ts,tsx,txt,webp,xls,xlsx,xml,yaml,yml,zip".split(
    ",",
  ),
);

function getPrimaryDomain(hostname: string): string {
  const clean = normalizeHostname(hostname).replace(/^www\./, "");
  if (isIpAddressHost(clean)) return clean;
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = parts.slice(-2).join(".");
  if (TWO_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function extractDisplayHostname(displayText: string): string | undefined {
  const trimmed = displayText.trim();
  if (!trimmed) return undefined;
  const token = trimmed.split(/\s+/)[0] ?? "";
  if (/^https?:\/\//i.test(token)) {
    try {
      return normalizeHostname(new URL(token).hostname) || undefined;
    } catch {
      return undefined;
    }
  }
  const slashIdx = token.search(/[/?#]/);
  const beforePath = slashIdx >= 0 ? token.slice(0, slashIdx) : token;
  if (beforePath.includes("@")) return undefined;
  const match = beforePath.match(
    /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?::\d{1,5})?$/i,
  );
  if (!match?.[1]) return undefined;
  const host = normalizeHostname(match[1]);
  const tld = host.split(".").pop() ?? "";
  if (!/^(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/.test(tld)) return undefined;
  if (slashIdx < 0 && NON_DOMAIN_EXTENSIONS.has(tld)) return undefined;
  return host;
}

export function inspectExternalLink(
  href: string,
  options: { displayText?: string; mailDanger?: boolean } = {},
): ExternalLinkInspection | null {
  const raw = href.trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) return null;

  const displayText = options.displayText?.trim() ?? "";
  const shownHostname = extractDisplayHostname(displayText);
  const reasons: ExternalLinkReason[] = [];
  let risk: ExternalLinkRisk = "normal";

  if (
    shownHostname &&
    getPrimaryDomain(shownHostname) !== getPrimaryDomain(hostname)
  ) {
    reasons.push("spoofed-text");
    risk = "danger";
  }
  if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
    reasons.push("punycode");
    risk = "danger";
  }
  if (options.mailDanger) {
    reasons.push("mail-danger");
    risk = "danger";
  }
  if (isIpAddressHost(hostname)) {
    reasons.push("ip-address");
    if (risk === "normal") risk = "warning";
  }
  if (parsed.protocol === "http:") {
    reasons.push("insecure-http");
    if (risk === "normal") risk = "warning";
  }

  return {
    fullUrl: parsed.toString(),
    hostname,
    protocol: parsed.protocol,
    displayText,
    shownHostname,
    risk,
    reasons,
    canTrust: risk === "normal" && parsed.protocol === "https:",
  };
}

export function canBypassExternalLinkConfirm(
  info: ExternalLinkInspection,
  profileId: string,
): boolean {
  // 高危与非安全链接无视白名单，强制弹窗拦截
  if (!info.canTrust) return false;
  return isDomainTrusted(profileId, info.hostname);
}

const PLAIN_URL_RE =
  /https?:\/\/[^\s<>"'`\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF]+/gi;
const TRAILING_PUNCT_RE = /[.,;:!?)\]}>]+$/;

export interface PlainTextSegment {
  type: "text" | "link";
  value: string;
}

export function splitPlainTextLinks(text: string): PlainTextSegment[] {
  if (!text) return [];
  const out: PlainTextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PLAIN_URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(TRAILING_PUNCT_RE, "");
    if (start > cursor) {
      out.push({ type: "text", value: text.slice(cursor, start) });
    }
    if (trimmed) {
      out.push({ type: "link", value: trimmed });
      if (trimmed.length < raw.length) {
        out.push({ type: "text", value: raw.slice(trimmed.length) });
      }
    } else {
      out.push({ type: "text", value: raw });
    }
    cursor = start + raw.length;
  }
  if (cursor < text.length) {
    out.push({ type: "text", value: text.slice(cursor) });
  }
  return out;
}
