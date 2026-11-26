import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { ComposeAttachmentsBar } from "./ComposeAttachmentsBar";
import { ComposeDropOverlay } from "./ComposeDropOverlay";
import { ComposeFooterBar, ComposeModalHeader } from "./ComposeFooterBar";
import { ComposeHeaderFields } from "./ComposeHeaderFields";
import { ComposeInlineAiBar } from "./ComposeInlineAiBar";
import {
  ComposeRichEditor,
  type ComposeRichEditorHandle,
} from "./ComposeRichEditor";
import { ComposeToolbar } from "./ComposeToolbar";
import { EMPTY_ACTIVE_FORMATS } from "./composeEditorCommands";
import { useComposeDropZone } from "./useComposeDropZone";
import { useInlineComposeAi } from "./useInlineComposeAi";

export function ComposeModal() {
  const { viewport, workspace, composeStore, toastStore, sendMailWithUndo } =
    useApp();
  const { t, formatTime } = useI18n();
  const activeDraft =
    composeStore.draft && !composeStore.draft.minimized
      ? composeStore.draft
      : null;
  const { rendered: draft, closing } = useValuePresence(activeDraft, 140);
  const editorHandleRef = useRef<ComposeRichEditorHandle | null>(null);
  const [activeFormats, setActiveFormats] = useState(EMPTY_ACTIVE_FORMATS);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkInitialText, setLinkInitialText] = useState("");
  const inlineAi = useInlineComposeAi(
    activeDraft,
    () => workspace.setOverlay({ type: "settings", tab: "ai" }),
    toastStore.pushToast,
  );
  const aiBusy = inlineAi.busy;

  const handleInsertInlineImage = useCallback(
    (url: string, cid: string, name: string) =>
      editorHandleRef.current?.insertInlineImage(url, cid, name),
    [],
  );

  const { dragging, shiftInline, uploadInlineImageFile, dragHandlers } =
    useComposeDropZone({
      draft,
      updateDraft: composeStore.updateDraft,
      pushToast: toastStore.pushToast,
      onInsertInlineImage: handleInsertInlineImage,
    });

  const handleEditorChange = useCallback(
    (body: string, bodyHtml: string) =>
      composeStore.updateDraft({ body, bodyHtml }),
    [composeStore],
  );

  const handleOpenLinkPopover = useCallback(() => {
    editorHandleRef.current?.saveSelection();
    setLinkInitialText(editorHandleRef.current?.getSelectedText() ?? "");
    setLinkPopoverOpen(true);
  }, []);

  if (!draft) return null;

  const isCompact = viewport === "compact";
  const minimizeDraft = () => {
    inlineAi.clearPreview();
    composeStore.updateDraft({ minimized: true });
  };

  const handleSend = () => {
    if (aiBusy) return;
    if (draft.to.length + draft.cc.length + draft.bcc.length === 0) {
      toastStore.pushToast({
        tone: "warning",
        title: t("toasts.addRecipientFirst"),
      });
      return;
    }
    if (!draft.subject.trim()) {
      workspace.setOverlay({ type: "danger-confirm", kind: "no-subject-send" });
      return;
    }
    sendMailWithUndo({
      accountId: draft.accountId,
      to: draft.to,
      subject: draft.subject,
      body: draft.body,
      scheduledAt: draft.scheduledAt,
      draft,
    });
    composeStore.closeDraft();
  };

  const modeTitle =
    draft.mode === "new"
      ? t("compose.newMailTitle")
      : draft.mode === "forward"
        ? t("compose.forwardMailTitle")
        : t("compose.replyMailTitle");

  return (
    <div
      className="overlay-motion-root"
      data-closing={closing ? "true" : "false"}
    >
      <div
        className="modal-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) minimizeDraft();
        }}
      >
        <div
          className="modal-card compose-modal-card"
          role="dialog"
          aria-modal="true"
          aria-label={t("compose.modalAria")}
          {...dragHandlers}
        >
          <ComposeDropOverlay visible={dragging} inlineMode={shiftInline} />

          <div className="compose-top-fixed">
            <ComposeModalHeader
              modeTitle={modeTitle}
              aiBusy={aiBusy}
              savedAtText={t("compose.autoSaved", {
                time: formatTime(draft.savedAt),
              })}
              onMinimize={minimizeDraft}
            />
            <ComposeHeaderFields />
            <ComposeToolbar
              activeFormats={activeFormats}
              linkPopoverOpen={linkPopoverOpen}
              linkInitialText={linkInitialText}
              aiBusy={aiBusy}
              onFormat={(cmd) => editorHandleRef.current?.execFormat(cmd)}
              onOpenLinkPopover={handleOpenLinkPopover}
              onCloseLinkPopover={() => setLinkPopoverOpen(false)}
              onConfirmLink={(url, text) => {
                editorHandleRef.current?.insertLink(url, text);
                setLinkPopoverOpen(false);
              }}
              onInsertInlineImage={handleInsertInlineImage}
              onSaveSelection={() => editorHandleRef.current?.saveSelection()}
            />
          </div>

          <FadeScroll label={t("compose.bodyScrollLabel")}>
            <ComposeInlineAiBar ai={inlineAi} />
            <ComposeRichEditor
              draftId={draft.id}
              body={draft.body}
              bodyHtml={draft.bodyHtml}
              readOnly={aiBusy}
              ariaLabel={t("compose.bodyAria")}
              placeholder={t("compose.bodyPlaceholder")}
              editorHandleRef={editorHandleRef}
              onChange={handleEditorChange}
              onActiveFormatsChange={setActiveFormats}
              onRequestSend={handleSend}
              onRequestLink={handleOpenLinkPopover}
              onPasteImageFile={uploadInlineImageFile}
            />
            <ComposeAttachmentsBar />
          </FadeScroll>

          <ComposeFooterBar
            scheduledAt={draft.scheduledAt}
            isCompact={isCompact}
            aiBusy={aiBusy}
            onSend={handleSend}
            onSchedule={() => {
              if (aiBusy) return;
              workspace.setOverlay({
                type: "schedule-send",
                draftId: draft.id,
              });
            }}
            onDiscard={() => {
              inlineAi.stopAssist();
              workspace.setOverlay({
                type: "danger-confirm",
                kind: "discard-draft",
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
