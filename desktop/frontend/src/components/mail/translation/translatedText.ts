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

export function createBodyTranslationRenderer(inner: HTMLElement) {
  const walker = inner.ownerDocument.createTreeWalker(
    inner,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Array<{
    node: Text;
    original: string;
    sibling?: HTMLSpanElement;
  }> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
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
    if (!hidden) nodes.push({ node, original: node.data });
  }

  return (translation?: BodyTranslation) => {
    // 始终按原始文字查找；提交新批次时不回退已完成节点或重建双语元素。
    for (const record of nodes) {
      const { node, original } = record;
      const text =
        translation && translatedSegment(original, translation.segments);
      const next =
        text && translation?.mode === "translated"
          ? original.replace(/\S[\s\S]*\S|\S/u, () => text)
          : original;
      if (node.data !== next) node.data = next;
      if (!text || translation?.mode !== "bilingual") {
        record.sibling?.remove();
        record.sibling = undefined;
        continue;
      }
      const label = ` ${text}`;
      if (!record.sibling) {
        const second = inner.ownerDocument.createElement("span");
        second.className = "omnimail-bilingual-text";
        second.lang = translation.target;
        second.textContent = label;
        node.after(second);
        record.sibling = second;
      } else {
        if (record.sibling.lang !== translation.target)
          record.sibling.lang = translation.target;
        if (record.sibling.textContent !== label)
          record.sibling.textContent = label;
      }
    }
  };
}
