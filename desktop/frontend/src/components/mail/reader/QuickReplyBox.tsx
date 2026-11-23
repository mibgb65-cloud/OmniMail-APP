import { FadeTextarea } from "../../common/scroll-fade/FadeTextarea";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";
import { Tooltip } from "../../common/Tooltip";

export function QuickReplyBox({ mail }: { mail: MailItem }) {
  const {
    viewport,
    workspace,
    composeStore,
    requestAiAction,
    sendMailWithUndo,
  } = useApp();
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const account =
    workspace.accounts.find((a) => a.id === mail.accountId) ??
    workspace.accounts[0];
  const hasText = Boolean(composeStore.quickReplyText.trim());
  const isOpen = viewport === "wide" || expanded || hasText;

  useEffect(() => {
    if (expanded) textareaRef.current?.focus();
  }, [expanded]);

  const handleSend = () => {
    const body = composeStore.quickReplyText.trim();
    if (!body) return;
    sendMailWithUndo({
      accountId: mail.accountId,
      to: [`${mail.senderName} <${mail.senderEmail}>`],
      subject: `Re: ${mail.subject.replace(/^Re:\s*/i, "")}`,
      body,
      replyToMailId: mail.id,
    });
    composeStore.setQuickReplyText("");
    setExpanded(false);
  };

  const senderLabel = `${account?.name ?? "工作邮箱"} · ${account?.providerLabel ?? "IMAP"}`;
  const openFullReply = () =>
    composeStore.openReplyCompose(
      mail,
      "reply",
      workspace.settings.lockReplyToOriginalAccount,
    );
  const draftAiReply = () =>
    requestAiAction("起草更正式回复", "请用更正式语气帮我起草一封回复");
  const headerStyle = {
    gap: 8,
    flex: 1,
    minWidth: 0,
    cursor: isOpen ? "default" : "text",
  } as const;

  return (
    <div className="quick-reply-wrap">
      <div className={isOpen ? "quick-reply-box" : "quick-reply-compact"}>
        <div
          className="row-between"
          style={headerStyle}
          onClick={() => !isOpen && setExpanded(true)}
        >
          <span className="row" style={{ gap: 7, minWidth: 0, flex: 1 }}>
            <Icon name="reply" size={14} />
            <span
              className="truncate"
              style={{
                fontSize: 13,
                fontWeight: isOpen ? 600 : 400,
                color: isOpen ? "var(--text-ink)" : "var(--text-muted)",
              }}
            >
              {isOpen
                ? `回复 ${mail.senderName}`
                : `回复 ${mail.senderName}（锁定${senderLabel}）…`}
            </span>
          </span>

          {isOpen ? (
            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
              <span className="pill pill-neutral quick-reply-lock-pill">
                <ProviderIcon
                  provider={account?.provider ?? mail.provider}
                  size={15}
                />
                <span className="truncate">通过 {senderLabel} 发送</span>
                <Icon name="lock" size={11} />
              </span>
              {viewport !== "wide" && !hasText && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpanded(false)}
                >
                  收起
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ height: 28, padding: "0 12px", flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
            >
              回复
            </button>
          )}
        </div>

        <div
          className="quick-reply-expand-grid"
          data-expanded={isOpen ? "true" : "false"}
        >
          <div className="quick-reply-expand-inner">
            <FadeTextarea
              ref={textareaRef}
              frameClassName="quick-reply-textarea-frame"
              surface="--quick-reply-surface"
              aria-label="快速回复正文"
              tabIndex={isOpen ? 0 : -1}
              className="quick-reply-textarea"
              value={composeStore.quickReplyText}
              onChange={(e) => composeStore.setQuickReplyText(e.target.value)}
              onBlur={() => {
                if (viewport !== "wide" && !composeStore.quickReplyText.trim())
                  setExpanded(false);
              }}
              placeholder="写下你的回复，或点击右侧 Omni AI 插入草稿后人工核对发送…"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div className="row-between" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 6, minWidth: 0 }}>
                <Tooltip label="完整回复窗口并添加附件" placement="top">
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 26, height: 26, flexShrink: 0 }}
                    aria-label="完整回复窗口并添加附件"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openFullReply}
                  >
                    <Icon name="paperclip" size={14} />
                  </button>
                </Tooltip>
                <Tooltip label="使用 Omni AI 起草回复" placement="top">
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 26, height: 26, color: "var(--brand-ai)" }}
                    aria-label="使用 Omni AI 起草回复"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={draftAiReply}
                  >
                    <Icon name="sparkle" size={14} />
                  </button>
                </Tooltip>
                <span className="text-xs text-muted truncate">
                  回复自动锁定原收件账户，避免发错身份
                </span>
              </div>

              <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                {viewport === "wide" && (
                  <span className="kbd">Ctrl + Enter</span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!hasText}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSend}
                >
                  <span>发送</span>
                  <Icon name="send" size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
