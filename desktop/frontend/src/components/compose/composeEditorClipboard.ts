import type { RefObject } from "react";
import {
  applyComposeFormat,
  cloneSelectionRange,
  insertInlineImageAtRange,
  insertSafeLinkAtRange,
  type ComposeActiveFormats,
  type ComposeFormatCommand,
} from "./composeEditorCommands";

export interface ComposeRichEditorHandle {
  execFormat: (cmd: ComposeFormatCommand) => void;
  insertLink: (url: string, displayText: string) => void;
  insertInlineImage: (
    url: string,
    contentId: string,
    filename?: string,
  ) => void;
  saveSelection: () => void;
  getSelectedText: () => string;
}

export interface ComposeRichEditorProps {
  draftId: string;
  body: string;
  bodyHtml?: string;
  readOnly?: boolean;
  placeholder: string;
  ariaLabel: string;
  editorHandleRef: RefObject<ComposeRichEditorHandle | null>;
  onChange: (plainText: string, safeHtml: string) => void;
  onActiveFormatsChange: (formats: ComposeActiveFormats) => void;
  onRequestSend: () => void;
  onRequestLink: () => void;
  onPasteImageFile: (file: File) => void;
}

export function extractClipboardImages(
  data: DataTransfer | null | undefined,
): File[] {
  return Array.from(data?.items ?? [])
    .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
    .map((it) => it.getAsFile())
    .filter((f): f is File => Boolean(f));
}

export function buildComposeEditorHandle(
  contentRef: RefObject<HTMLDivElement | null>,
  savedRangeRef: RefObject<Range | null>,
  readOnly: boolean,
  syncFromDom: () => void,
): ComposeRichEditorHandle {
  return {
    execFormat: (cmd) => {
      if (!contentRef.current || readOnly) return;
      applyComposeFormat(contentRef.current, cmd);
      syncFromDom();
    },
    insertLink: (url, displayText) => {
      if (!contentRef.current || readOnly) return;
      insertSafeLinkAtRange(
        contentRef.current,
        savedRangeRef.current,
        url,
        displayText,
      );
      savedRangeRef.current = null;
      syncFromDom();
    },
    insertInlineImage: (url, contentId, filename = "") => {
      if (!contentRef.current || readOnly) return;
      insertInlineImageAtRange(
        contentRef.current,
        savedRangeRef.current,
        url,
        contentId,
        filename,
      );
      savedRangeRef.current = null;
      syncFromDom();
    },
    saveSelection: () => {
      savedRangeRef.current = cloneSelectionRange(contentRef.current);
    },
    getSelectedText: () =>
      cloneSelectionRange(contentRef.current)?.toString().trim() ?? "",
  };
}
