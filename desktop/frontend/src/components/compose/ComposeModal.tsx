import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import {
  ComposeAttachmentsBar,
  buildDemoDraftAttachment,
} from "./ComposeAttachmentsBar";
import { ComposeHeaderFields } from "./ComposeHeaderFields";
import { ComposeInlineAiBar } from "./ComposeInlineAiBar";

export function ComposeModal() {
  const { viewport, workspace, composeStore, toastStore, sendMailWithUndo } =
    useApp();
  const draft = composeStore.draft;
  if (!draft || draft.minimized) return null;

  const isCompact = viewport === "compact";
  const minimizeDraft = () => composeStore.updateDraft({ minimized: true });

  const handleSend = () => {
    if (draft.to.length === 0) {
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
    });
    composeStore.closeDraft();
  };

  const addDemoAttachment = (simulateFailure = false) =>
    composeStore.updateDraft({
      attachments: [
        ...draft.attachments,
        buildDemoDraftAttachment(simulateFailure),
      ],
    });

  return (
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
              <h2 className="modal-title truncate">
                {draft.mode === "new"
                  ? "新邮件"
                  : draft.mode === "forward"
                    ? "转发邮件"
                    : "回复邮件"}
              </h2>
              <span className="pill pill-neutral truncate">
                已自动保存 {draft.savedAt}
              </span>
            </div>
            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="最小化到右下角草稿栏"
                onClick={minimizeDraft}
              >
                <Icon name="minus" size={14} /> 收起
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-bordered"
                style={{ width: 28, height: 28 }}
                title="关闭并保留草稿"
                aria-label="关闭写信窗口"
                onClick={minimizeDraft}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>

          <ComposeHeaderFields />

          <div className="compose-toolbar">
            <div className="row" style={{ gap: 4, minWidth: 0 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => addDemoAttachment(false)}
              >
                <Icon name="paperclip" size={13} /> 添加附件
              </button>
              {!isCompact && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => addDemoAttachment(true)}
                >
                  模拟超限附件
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  workspace.setOverlay({
                    type: "attachment-transfer",
                    mode: "transfer",
                  })
                }
              >
                传输队列
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ai btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() =>
                composeStore.updateDraft({ inlineAiOpen: !draft.inlineAiOpen })
              }
            >
              <Icon name="sparkle" size={13} />
              {draft.inlineAiOpen ? "收起 AI" : "Omni AI 起草"}
            </button>
          </div>
        </div>

        <div className="compose-body-scroll">
          <ComposeInlineAiBar />
          <textarea
            className="compose-editor"
            value={draft.body}
            onChange={(e) => composeStore.updateDraft({ body: e.target.value })}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入邮件正文…支持插入 AI 改写建议与本地签名。"
          />
          <ComposeAttachmentsBar />
        </div>

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
            {!isCompact && <span className="text-xs text-muted">快速发送</span>}
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              style={{ width: 32, height: 32, color: "var(--status-danger)" }}
              title="删除草稿"
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
          </div>
        </div>
      </div>
    </div>
  );
}
