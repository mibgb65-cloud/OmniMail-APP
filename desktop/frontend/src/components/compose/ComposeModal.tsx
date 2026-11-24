import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { FadeTextarea } from "../common/scroll-fade/FadeTextarea";
import { ComposeAttachmentsBar } from "./ComposeAttachmentsBar";
import { ComposeHeaderFields, ComposeToolbar } from "./ComposeHeaderFields";
import { ComposeInlineAiBar } from "./ComposeInlineAiBar";

export function ComposeModal() {
  const { viewport, workspace, composeStore, toastStore, sendMailWithUndo } =
    useApp();
  const { t, formatTime } = useI18n();
  const activeDraft =
    composeStore.draft && !composeStore.draft.minimized
      ? composeStore.draft
      : null;
  const { rendered: draft, closing } = useValuePresence(activeDraft, 140);
  if (!draft) return null;

  const isCompact = viewport === "compact";
  const minimizeDraft = () => composeStore.updateDraft({ minimized: true });

  const handleSend = () => {
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
        >
          <div className="compose-top-fixed">
            <div className="modal-header compose-modal-header">
              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                <h2 className="modal-title truncate">{modeTitle}</h2>
                <span className="pill pill-neutral truncate">
                  {t("compose.autoSaved", { time: formatTime(draft.savedAt) })}
                </span>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <Tooltip label={t("compose.minimizeTip")}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={minimizeDraft}
                  >
                    <Icon name="minus" size={14} /> {t("compose.minimizeBtn")}
                  </button>
                </Tooltip>
                <Tooltip label={t("compose.closeKeepDraftTip")} shortcut="Esc">
                  <button
                    type="button"
                    className="icon-btn icon-btn-bordered"
                    style={{ width: 28, height: 28 }}
                    aria-label={t("compose.closeComposeAria")}
                    onClick={minimizeDraft}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </Tooltip>
              </div>
            </div>

            <ComposeHeaderFields />
            <ComposeToolbar />
          </div>

          <FadeScroll label={t("compose.bodyScrollLabel")}>
            <ComposeInlineAiBar />
            <FadeTextarea
              className="compose-editor"
              frameClassName="compose-editor-frame"
              aria-label={t("compose.bodyAria")}
              value={draft.body}
              onChange={(e) =>
                composeStore.updateDraft({ body: e.target.value })
              }
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("compose.bodyPlaceholder")}
            />
            <ComposeAttachmentsBar />
          </FadeScroll>

          <div className="modal-footer compose-footer-fixed">
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
              >
                <span>
                  {draft.scheduledAt
                    ? t("compose.confirmScheduleSend")
                    : t("compose.sendBtn")}
                </span>
                <Icon name="send" size={13} />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  workspace.setOverlay({
                    type: "schedule-send",
                    draftId: draft.id,
                  })
                }
              >
                <Icon name="clock" size={13} /> {t("compose.scheduleSendBtn")}
              </button>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <span className="kbd">Ctrl + Enter</span>
              {!isCompact && (
                <span className="text-xs text-muted">
                  {t("compose.quickSendHint")}
                </span>
              )}
              <Tooltip label={t("compose.deleteDraftTip")} placement="top">
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered"
                  style={{
                    width: 32,
                    height: 32,
                    color: "var(--status-danger)",
                  }}
                  aria-label={t("compose.deleteDraftTip")}
                  onClick={() =>
                    workspace.setOverlay({
                      type: "danger-confirm",
                      kind: "discard-draft",
                    })
                  }
                >
                  <Icon name="trash" size={14} />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
