import {
  buildInlineImageHtml,
  escapeHtmlAttr,
  sanitizeComposeHtml,
} from "./composeRichHtml";

export type ComposeFormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "blockquote"
  | "code"
  | "removeFormat";

export interface ComposeActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
  blockquote: boolean;
  code: boolean;
}

export const EMPTY_ACTIVE_FORMATS: ComposeActiveFormats = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  blockquote: false,
  code: false,
};

function hasAncestorTag(
  node: Node | null,
  root: HTMLElement,
  tagName: string,
): boolean {
  let cur: Node | null = node;
  const upper = tagName.toUpperCase();
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE && cur.nodeName === upper) {
      return true;
    }
    cur = cur.parentNode;
  }
  return false;
}

export function queryComposeActiveFormats(
  editor: HTMLElement | null,
): ComposeActiveFormats {
  if (!editor) return EMPTY_ACTIVE_FORMATS;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
    return EMPTY_ACTIVE_FORMATS;
  }
  const safeState = (cmd: string): boolean => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };
  return {
    bold: safeState("bold"),
    italic: safeState("italic"),
    underline: safeState("underline"),
    strikeThrough: safeState("strikeThrough"),
    insertUnorderedList: safeState("insertUnorderedList"),
    insertOrderedList: safeState("insertOrderedList"),
    blockquote: hasAncestorTag(sel.anchorNode, editor, "blockquote"),
    code: hasAncestorTag(sel.anchorNode, editor, "code"),
  };
}

export function cloneSelectionRange(editor: HTMLElement | null): Range | null {
  if (!editor) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer)
    ? range.cloneRange()
    : null;
}

export function restoreSelectionRange(
  editor: HTMLElement,
  savedRange: Range | null,
): void {
  editor.focus();
  const sel = window.getSelection();
  if (!sel) return;
  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return;
  }
  if (sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    sel.removeAllRanges();
    sel.addRange(end);
  }
}

function toggleInlineCode(editor: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  let cur: Node | null = range.commonAncestorContainer;
  while (cur && cur !== editor) {
    if (cur.nodeType === Node.ELEMENT_NODE && cur.nodeName === "CODE") {
      const parent = cur.parentNode;
      if (parent) {
        const text = document.createTextNode(cur.textContent ?? "");
        parent.replaceChild(text, cur);
        const next = document.createRange();
        next.selectNodeContents(text);
        next.collapse(false);
        sel.removeAllRanges();
        sel.addRange(next);
      }
      return;
    }
    cur = cur.parentNode;
  }
  const selected = range.toString() || "code";
  const html = `<code>${escapeHtmlAttr(selected)}</code>\u200B`;
  document.execCommand("insertHTML", false, html);
}

export function applyComposeFormat(
  editor: HTMLElement,
  cmd: ComposeFormatCommand,
): void {
  editor.focus();
  if (cmd === "code") {
    toggleInlineCode(editor);
    return;
  }
  if (cmd === "blockquote") {
    const sel = window.getSelection();
    const inQuote = sel && hasAncestorTag(sel.anchorNode, editor, "blockquote");
    document.execCommand("formatBlock", false, inQuote ? "div" : "blockquote");
    return;
  }
  if (cmd === "removeFormat") {
    document.execCommand("removeFormat", false);
    document.execCommand("formatBlock", false, "div");
    return;
  }
  document.execCommand(cmd, false);
}

export function insertSafeLinkAtRange(
  editor: HTMLElement,
  savedRange: Range | null,
  url: string,
  displayText: string,
): void {
  restoreSelectionRange(editor, savedRange);
  const label = escapeHtmlAttr(displayText.trim() || url);
  const safeHref = escapeHtmlAttr(url);
  document.execCommand(
    "insertHTML",
    false,
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
}

export function insertInlineImageAtRange(
  editor: HTMLElement,
  savedRange: Range | null,
  url: string,
  contentId: string,
  alt: string,
): void {
  restoreSelectionRange(editor, savedRange);
  const html = `${buildInlineImageHtml(url, contentId, alt)}<br />`;
  document.execCommand("insertHTML", false, html);
}

export function insertSanitizedPastedHtml(
  editor: HTMLElement,
  rawHtml: string,
): void {
  const safe = sanitizeComposeHtml(rawHtml);
  if (!safe) return;
  editor.focus();
  document.execCommand("insertHTML", false, safe);
}
