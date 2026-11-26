const DARK_SCOPES = [
  '.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"]',
];
const LIGHT_SCOPES = [
  '.mail-html-inner[data-theme="light"]',
  '.mail-html-inner[data-theme="dark"][data-html-mode="paper"]',
];

const PREFERS_CS_RE = /^\(\s*prefers-color-scheme\s*:\s*([a-z-]+)\s*\)$/i;

function splitTopCommas(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && depth > 0) depth--;
    else if (ch === "," && depth === 0) {
      out.push(input.slice(start, i));
      start = i + 1;
    }
  }
  out.push(input.slice(start));
  return out;
}

function splitMediaAnd(mq: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < mq.length; i++) {
    const ch = mq[i];
    if (ch === "(") depth++;
    else if (ch === ")" && depth > 0) depth--;
    else if (
      depth === 0 &&
      mq.slice(i, i + 3).toLowerCase() === "and" &&
      (i === 0 || mq[i - 1] <= " " || mq[i - 1] === ")") &&
      (i + 3 === mq.length || mq[i + 3] <= " " || mq[i + 3] === "(")
    ) {
      out.push(mq.slice(start, i));
      i += 2;
      start = i + 1;
    }
  }
  out.push(mq.slice(start));
  return out;
}

function scopeOneSelector(rawSel: string, scope: string): string {
  const normalized = rawSel
    .replace(/:(?:host(?:\([^)]*\))?|root)\b/gi, ".mail-html-inner")
    .replace(/(^|[\s,{>;+~])html\s*(?:>\s*)?body\b/gi, "$1.mail-html-inner")
    .replace(/(^|[\s,{>;+~])(?:html|body)\b/gi, "$1.mail-html-inner")
    .trim();
  const rootCls = ".mail-html-inner";
  if (normalized.startsWith(scope)) return normalized;
  if (normalized.startsWith(rootCls)) {
    const rest = normalized.slice(rootCls.length);
    if (!rest || !/[A-Za-z0-9_-]/.test(rest[0])) {
      return `${scope}${rest}`;
    }
  }
  return `${scope} ${normalized}`;
}

function scopeInnerRules(cssBody: string, scopes: string[]): string {
  const rules: string[] = [];
  let i = 0;
  const n = cssBody.length;
  while (i < n) {
    while (i < n && (cssBody[i] <= " " || cssBody[i] === ";")) i++;
    if (i >= n) break;
    const selStart = i;
    while (i < n && cssBody[i] !== "{" && cssBody[i] !== ";") i++;
    if (i >= n) break;
    if (cssBody[i] === ";") {
      i++;
      continue;
    }
    const selText = cssBody.slice(selStart, i).trim();
    const [declBody, nextIdx] = readBraces(cssBody, i);
    i = nextIdx;
    if (!selText || selText.startsWith("@") || !declBody.trim()) continue;
    const sels = splitTopCommas(selText)
      .map((s) => s.trim())
      .filter(Boolean);
    const scoped = sels.flatMap((s) =>
      scopes.map((sc) => scopeOneSelector(s, sc)),
    );
    if (scoped.length > 0) {
      rules.push(`${scoped.join(", ")} { ${declBody.trim()} }`);
    }
  }
  return rules.join("\n");
}

function readBraces(s: string, openIdx: number): [string, number] {
  let depth = 0;
  let quote = "";
  const start = openIdx + 1;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\" && i + 1 < s.length) i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return [s.slice(start, i), i + 1];
    }
  }
  return [s.slice(start), s.length];
}

export function rewriteCssPrefersColorScheme(css: string): string {
  if (!/prefers-color-scheme/i.test(css)) return css;
  let out = "";
  let i = 0;
  const n = css.length;
  while (i < n) {
    const atIdx = css.indexOf("@", i);
    if (atIdx < 0) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, atIdx);
    let headEnd = atIdx;
    while (headEnd < n && css[headEnd] !== "{" && css[headEnd] !== ";") {
      headEnd++;
    }
    if (headEnd >= n || css[headEnd] === ";") {
      const end = headEnd < n ? headEnd + 1 : n;
      out += css.slice(atIdx, end);
      i = end;
      continue;
    }
    const head = css.slice(atIdx, headEnd).trim();
    const [body, nextIdx] = readBraces(css, headEnd);
    i = nextIdx;
    if (!/^@media\b/i.test(head) || !/prefers-color-scheme/i.test(head)) {
      out += `${css.slice(atIdx, headEnd)}{${body}}`;
      continue;
    }
    const mqRaw = head.replace(/^@media\b/i, "").trim();
    const blocks: string[] = [];
    for (const part of splitTopCommas(mqRaw)) {
      const clauses = splitMediaAnd(part.trim());
      let scheme = "";
      const kept: string[] = [];
      for (const rawC of clauses) {
        const c = rawC.trim();
        if (!c) continue;
        const m = PREFERS_CS_RE.exec(c);
        if (m?.[1]) {
          scheme = m[1].toLowerCase();
          continue;
        }
        kept.push(c);
      }
      if (scheme !== "dark" && scheme !== "light") continue;
      const scoped = scopeInnerRules(
        body,
        scheme === "dark" ? DARK_SCOPES : LIGHT_SCOPES,
      );
      if (!scoped) continue;
      const nonTrivial = kept.filter(
        (c) => !/^(?:only\s+)?(?:screen|all)$/i.test(c.replace(/\s+/g, " ")),
      );
      blocks.push(
        nonTrivial.length > 0
          ? `@media ${kept.join(" and ")} {\n${scoped}\n}`
          : scoped,
      );
    }
    out += blocks.join("\n");
  }
  return out;
}

export function normalizeMailHtmlColorScheme(html: string): string {
  if (!html || !/prefers-color-scheme/i.test(html)) return html;
  return html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (full, cssBody: string) => {
      if (!/prefers-color-scheme/i.test(cssBody)) return full;
      const rewritten = rewriteCssPrefersColorScheme(cssBody).trim();
      return rewritten ? `<style>${rewritten}</style>` : "";
    },
  );
}
