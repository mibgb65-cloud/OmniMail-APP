import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import {
  extractClipboardImages,
  type ComposeRichEditorHandle,
  type ComposeRichEditorProps,
} from "./composeEditorClipboard";
import {
  applyComposeFormat,
  cloneSelectionRange,
  insertInlineImageAtRange,
  insertSafeLinkAtRange,
  insertSanitizedPastedHtml,
  queryComposeActiveFormats,
} from "./composeEditorCommands";
import {
  extractPlainTextFromHtml,
  plainTextToComposeHtml,
  sanitizeComposeHtml,
} from "./composeRichHtml";
import { useComposeInlineImageSelection } from "./useComposeInlineImageSelection";

export type { ComposeRichEditorHandle };

export function ComposeRichEditor(props: ComposeRichEditorProps) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastEmittedRef = useRef<string>("");
  const lastDraftIdRef = useRef<string>("");
  const { onChange, onActiveFormatsChange, editorHandleRef } = props;

  const syncFromDom = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const safeHtml = sanitizeComposeHtml(el.innerHTML);
    lastEmittedRef.current = safeHtml;
    onChange(extractPlainTextFromHtml(safeHtml), safeHtml);
    onActiveFormatsChange(queryComposeActiveFormats(el));
  }, [onChange, onActiveFormatsChange]);

  const {
    imgBtnPos,
    clearSelectedImg,
    resetSelectedImgRefOnly,
    removeSelectedImage,
    handleEditorClick,
    hasSelectedImage,
  } = useComposeInlineImageSelection(wrapRef, syncFromDom);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const incoming = sanitizeComposeHtml(
      props.bodyHtml?.trim()
        ? props.bodyHtml
        : plainTextToComposeHtml(props.body),
    );
    if (
      lastDraftIdRef.current !== props.draftId ||
      incoming !== lastEmittedRef.current
    ) {
      lastDraftIdRef.current = props.draftId;
      lastEmittedRef.current = incoming;
      el.innerHTML = incoming;
      resetSelectedImgRefOnly();
    }
  }, [props.draftId, props.body, props.bodyHtml, resetSelectedImgRefOnly]);

  useEffect(() => {
    const onSelChange = () => {
      const el = contentRef.current;
      if (el && document.activeElement === el) {
        onActiveFormatsChange(queryComposeActiveFormats(el));
      }
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, [onActiveFormatsChange]);

  useImperativeHandle(
    editorHandleRef,
    () => ({
      execFormat: (cmd) => {
        if (!contentRef.current) return;
        applyComposeFormat(contentRef.current, cmd);
        syncFromDom();
      },
      insertLink: (url, displayText) => {
        if (!contentRef.current) return;
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
        if (!contentRef.current) return;
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
    }),
    [syncFromDom],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      props.onRequestSend();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      savedRangeRef.current = cloneSelectionRange(contentRef.current);
      props.onRequestLink();
    } else if (
      hasSelectedImage() &&
      (e.key === "Backspace" || e.key === "Delete")
    ) {
      e.preventDefault();
      removeSelectedImage();
    } else if (hasSelectedImage() && e.key === "Escape") {
      clearSelectedImg();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const imgFiles = extractClipboardImages(e.clipboardData);
    if (imgFiles.length > 0) {
      e.preventDefault();
      savedRangeRef.current = cloneSelectionRange(contentRef.current);
      imgFiles.forEach(props.onPasteImageFile);
      return;
    }
    const rawHtml = e.clipboardData?.getData("text/html") ?? "";
    if (rawHtml.trim() && contentRef.current) {
      e.preventDefault();
      insertSanitizedPastedHtml(contentRef.current, rawHtml);
      syncFromDom();
    }
  };

  const isEmpty =
    !props.body.trim() && !(props.bodyHtml ?? "").includes("<img");

  return (
    <div ref={wrapRef} className="compose-rich-wrap">
      <div
        ref={contentRef}
        className="compose-editor compose-rich-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={props.ariaLabel}
        data-placeholder={props.placeholder}
        data-empty={isEmpty ? "true" : "false"}
        onInput={syncFromDom}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          savedRangeRef.current = cloneSelectionRange(contentRef.current);
        }}
      />
      {imgBtnPos && (
        <button
          type="button"
          className="compose-inline-img-del"
          style={{ top: imgBtnPos.top, left: imgBtnPos.left }}
          aria-label={t("compose.removeInlineImageAria")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={removeSelectedImage}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}
