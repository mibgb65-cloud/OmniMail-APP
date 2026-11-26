import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import {
  buildComposeEditorHandle,
  extractClipboardImages,
  type ComposeRichEditorHandle,
  type ComposeRichEditorProps,
} from "./composeEditorClipboard";
import {
  cloneSelectionRange,
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
  const {
    readOnly = false,
    onChange,
    onActiveFormatsChange,
    editorHandleRef,
  } = props;

  const syncFromDom = useCallback(() => {
    const el = contentRef.current;
    if (!el || readOnly) return;
    const safeHtml = sanitizeComposeHtml(el.innerHTML);
    lastEmittedRef.current = safeHtml;
    onChange(extractPlainTextFromHtml(safeHtml), safeHtml);
    onActiveFormatsChange(queryComposeActiveFormats(el));
  }, [onActiveFormatsChange, onChange, readOnly]);

  const imgSel = useComposeInlineImageSelection(wrapRef, syncFromDom);
  const { imgBtnPos, resetSelectedImgRefOnly } = imgSel;

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
    () =>
      buildComposeEditorHandle(
        contentRef,
        savedRangeRef,
        readOnly,
        syncFromDom,
      ),
    [readOnly, syncFromDom],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      props.onRequestSend();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      savedRangeRef.current = cloneSelectionRange(contentRef.current);
      props.onRequestLink();
    } else if (
      imgSel.hasSelectedImage() &&
      (e.key === "Backspace" || e.key === "Delete")
    ) {
      e.preventDefault();
      imgSel.removeSelectedImage();
    } else if (imgSel.hasSelectedImage() && e.key === "Escape") {
      imgSel.clearSelectedImg();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
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
    <div
      ref={wrapRef}
      className={`compose-rich-wrap${readOnly ? " is-readonly" : ""}`}
    >
      {readOnly && (
        <div className="compose-readonly-banner" role="status">
          <span className="compose-readonly-title">
            <Icon name="lock" size={12} />
            <span>{t("compose.editorReadonlyPill")}</span>
          </span>
        </div>
      )}
      <div
        ref={contentRef}
        className="compose-editor compose-rich-editor"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-readonly={readOnly ? "true" : undefined}
        aria-label={props.ariaLabel}
        data-placeholder={props.placeholder}
        data-empty={isEmpty ? "true" : "false"}
        onInput={syncFromDom}
        onClick={readOnly ? undefined : imgSel.handleEditorClick}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          savedRangeRef.current = cloneSelectionRange(contentRef.current);
        }}
      />
      {!readOnly && imgBtnPos && (
        <button
          type="button"
          className="compose-inline-img-del"
          style={{ top: imgBtnPos.top, left: imgBtnPos.left }}
          aria-label={t("compose.removeInlineImageAria")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={imgSel.removeSelectedImage}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}
