import type { RefObject } from "react";
import type {
  ComposeActiveFormats,
  ComposeFormatCommand,
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
