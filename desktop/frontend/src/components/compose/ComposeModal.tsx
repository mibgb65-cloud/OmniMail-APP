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
        title: "请先添加至少一位收件人",
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
      ? "新邮件"
      : draft.mode === "forward"
        ? "转发邮件"
        : "回复邮件";

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
          aria-label="写邮件"
        >
          <div className="compose-top-fixed">
            <div className="modal-header compose-modal-header">
              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                <h2 className="modal-title truncate">{modeTitle}</h2>
                <span className="pill pill-neutral truncate">
                  已自动保存 {draft.savedAt}
                </span>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <Tooltip label="最小化到右下角草稿栏">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={minimizeDraft}
                  >
                    <Icon name="minus" size={14} /> 收起
                  </button>
                </Tooltip>
                <Tooltip label="关闭并保留草稿" shortcut="Esc">
                  <button
                    type="button"
                    className="icon-btn icon-btn-bordered"
                    style={{ width: 28, height: 28 }}
                    aria-label="关闭写信窗口"
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

          <FadeScroll label="邮件正文编辑区">
            <ComposeInlineAiBar />
            <FadeTextarea
              className="compose-editor"
              frameClassName="compose-editor-frame"
              aria-label="邮件正文"
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
              placeholder="输入邮件正文…支持插入 AI 改写建议与本地签名。"
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
                <span>{draft.scheduledAt ? "确认定时发送" : "发送"}</span>
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
                <Icon name="clock" size={13} /> 定时发送
              </button>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <span className="kbd">Ctrl + Enter</span>
              {!isCompact && (
                <span className="text-xs text-muted">快速发送</span>
              )}
              <Tooltip label="删除草稿" placement="top">
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered"
                  style={{
                    width: 32,
                    height: 32,
                    color: "var(--status-danger)",
                  }}
                  aria-label="删除草稿"
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
