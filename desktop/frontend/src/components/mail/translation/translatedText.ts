import type { TranslatedMode } from "./translationTypes";

export interface BodyTranslation {
  mode: TranslatedMode;
  segments: Record<string, string | undefined>;
  target: string;
}

export function translatedSegment(
  value: string,
  segments: Record<string, string | undefined>,
) {
  const key = value.trim();
  return Object.prototype.hasOwnProperty.call(segments, key) &&
    segments[key] !== key
    ? segments[key]
    : undefined;
}

const skip =
  "script,style,pre,code,textarea,template,svg,math,title,noscript,[hidden]";
const hiddenStyle =
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i;

export function applyBodyTranslation(
  inner: HTMLElement,
  translation: BodyTranslation,
) {
  const walker = inner.ownerDocument.createTreeWalker(
    inner,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Text[] = [];
  const restore: Array<() => void> = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest(skip)) continue;
    let hidden = false;
    for (
      let ancestor: HTMLElement | null = parent;
      ancestor && ancestor !== inner;
      ancestor = ancestor.parentElement
    ) {
      if (hiddenStyle.test(ancestor.getAttribute("style") ?? "")) {
        hidden = true;
        break;
      }
    }
    if (hidden) continue;
    const text = translatedSegment(node.data, translation.segments);
    if (!text) continue;
    if (translation.mode === "translated") {
      const original = node.data;
      node.data = node.data.replace(/\S[\s\S]*\S|\S/u, () => text);
      restore.push(() => {
        node.data = original;
      });
    } else {
      const second = inner.ownerDocument.createElement("span");
      second.className = "omnimail-bilingual-text";
      second.lang = translation.target;
      second.textContent = ` ${text}`;
      node.after(second);
      restore.push(() => second.remove());
    }
  }
  return () => restore.forEach((undo) => undo());
}
