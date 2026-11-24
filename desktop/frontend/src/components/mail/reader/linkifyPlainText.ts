export type LinkifySegment =
  | { type: "text"; text: string }
  | { type: "url"; text: string; href: string }
  | { type: "email"; text: string; email: string; href: string };

const ALWAYS_STRIP_TRAILING = new Set([
  ".",
  ",",
  ";",
  ":",
  "!",
  "?",
  "'",
  '"',
  ">",
  "。",
  "，",
  "、",
  "；",
  "：",
  "！",
  "？",
  "）",
  "》",
  "】",
  "」",
  "』",
  "”",
  "’",
]);

const BALANCED_CLOSERS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

const COMBINED_TOKEN_RE =
  /(https?:\/\/[^\s<>"'`\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF]+)|(\bwww\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF]*)?)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)/gi;

function countChar(str: string, ch: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) count++;
  }
  return count;
}

function trimTrailingUrlPunct(raw: string): { clean: string; suffix: string } {
  let end = raw.length;
  while (end > 0) {
    const ch = raw[end - 1];
    if (ALWAYS_STRIP_TRAILING.has(ch)) {
      end--;
      continue;
    }
    const opener = BALANCED_CLOSERS[ch];
    if (opener) {
      const slice = raw.slice(0, end);
      if (countChar(slice, ch) > countChar(slice, opener)) {
        end--;
        continue;
      }
    }
    break;
  }
  return { clean: raw.slice(0, end), suffix: raw.slice(end) };
}

function isBoundaryBefore(text: string, index: number): boolean {
  if (index <= 0) return true;
  const prev = text[index - 1];
  return !/[a-zA-Z0-9@._/%-]/.test(prev);
}

function pushText(out: LinkifySegment[], text: string) {
  if (!text) return;
  const prev = out[out.length - 1];
  if (prev?.type === "text") {
    prev.text += text;
  } else {
    out.push({ type: "text", text });
  }
}

export function linkifyPlainText(text: string): LinkifySegment[] {
  if (!text) return [];
  const out: LinkifySegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(COMBINED_TOKEN_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const httpMatch = match[1];
    const wwwMatch = match[2];
    const emailMatch = match[3];

    if (start > cursor) {
      pushText(out, text.slice(cursor, start));
    }

    if (httpMatch) {
      const { clean, suffix } = trimTrailingUrlPunct(httpMatch);
      if (clean && /^https?:\/\/[^/\s]+/i.test(clean)) {
        out.push({ type: "url", text: clean, href: clean });
        pushText(out, suffix);
      } else {
        pushText(out, raw);
      }
    } else if (wwwMatch) {
      if (!isBoundaryBefore(text, start)) {
        pushText(out, raw);
      } else {
        const { clean, suffix } = trimTrailingUrlPunct(wwwMatch);
        if (clean.length > 4) {
          out.push({ type: "url", text: clean, href: `https://${clean}` });
          pushText(out, suffix);
        } else {
          pushText(out, raw);
        }
      }
    } else if (emailMatch) {
      const prevChar = start > 0 ? text[start - 1] : "";
      if (prevChar && /[a-zA-Z0-9._%+-]/.test(prevChar)) {
        pushText(out, raw);
      } else {
        out.push({
          type: "email",
          text: emailMatch,
          email: emailMatch,
          href: `mailto:${emailMatch}`,
        });
      }
    } else {
      pushText(out, raw);
    }

    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    pushText(out, text.slice(cursor));
  }
  return out;
}
