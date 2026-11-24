// 写信富文本 HTML 安全清洗、纯文本提取与安全链接校验（纯函数，无 DOM 依赖，便于单测）。

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "br",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
]);

const STRIP_CONTENT_RE =
  /<\s*(script|style|iframe|object|embed|svg|math|noscript|template|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSE_DANGER_RE =
  /<\s*(script|style|iframe|object|embed|svg|math|link|meta|base|input|button|textarea|select)[^>]*\/?>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s[^<>]*?)?\/?>/g;
const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function isSafeComposeHref(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

export function normalizeComposeHref(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return isSafeComposeHref(trimmed) ? trimmed : null;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  const withHttps = `https://${trimmed}`;
  return isSafeComposeHref(withHttps) ? withHttps : null;
}

function isSafeComposeImageSrc(rawSrc: string): boolean {
  const trimmed = rawSrc.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/omnimail-cid/")) return true;
  if (trimmed.startsWith("blob:")) return true;
  return false;
}

function extractTagAttrs(rawAttrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawAttrs) return out;
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(rawAttrs)) !== null) {
    const name = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (!name.startsWith("on")) {
      out[name] = unescapeBasicEntities(val);
    }
  }
  return out;
}

/**
 * 清洗粘贴或编辑产生的富文本 HTML：
 * 剔除脚本、事件属性、危险协议与破坏布局的外联样式，仅保留安全排版语义与本地内嵌图。
 */
export function sanitizeComposeHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return "";
  let cleaned = rawHtml
    .replace(COMMENT_RE, "")
    .replace(STRIP_CONTENT_RE, "")
    .replace(SELF_CLOSE_DANGER_RE, "");

  cleaned = cleaned.replace(TAG_RE, (full, rawTag: string, rawAttrs = "") => {
    const tag = rawTag.toLowerCase();
    const isClosing = full.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (isClosing) {
      return tag === "br" || tag === "img" || tag === "hr" ? "" : `</${tag}>`;
    }
    if (tag === "br" || tag === "hr") return `<${tag} />`;

    const attrs = extractTagAttrs(rawAttrs);
    if (tag === "a") {
      const href = attrs.href?.trim() ?? "";
      if (!isSafeComposeHref(href)) return "<a>";
      return `<a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer">`;
    }
    if (tag === "img") {
      const src = attrs.src?.trim() ?? "";
      if (!isSafeComposeImageSrc(src)) return "";
      const cid = attrs["data-cid"]?.trim() ?? "";
      const alt = attrs.alt?.trim() ?? "";
      const parts = [`src="${escapeHtmlAttr(src)}"`];
      if (cid) parts.push(`data-cid="${escapeHtmlAttr(cid)}"`);
      if (alt) parts.push(`alt="${escapeHtmlAttr(alt)}"`);
      return `<img ${parts.join(" ")} />`;
    }
    return `<${tag}>`;
  });

  return cleaned.trim();
}

export function buildInlineImageHtml(
  url: string,
  contentId: string,
  alt = "",
): string {
  const parts = [
    `src="${escapeHtmlAttr(url)}"`,
    `data-cid="${escapeHtmlAttr(contentId)}"`,
  ];
  if (alt.trim()) {
    parts.push(`alt="${escapeHtmlAttr(alt.trim())}"`);
  }
  return `<img ${parts.join(" ")} />`;
}

export function extractPlainTextFromHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return "";
  const prepared = rawHtml
    .replace(COMMENT_RE, "")
    .replace(STRIP_CONTENT_RE, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*(p|div|li|blockquote|pre|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*hr\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]+>/g, "");

  return unescapeBasicEntities(prepared)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function plainTextToComposeHtml(text: string): string {
  if (!text) return "";
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return "";
  return normalized
    .split("\n")
    .map((line) =>
      line ? `<div>${escapeHtmlAttr(line)}</div>` : "<div><br /></div>",
    )
    .join("");
}
