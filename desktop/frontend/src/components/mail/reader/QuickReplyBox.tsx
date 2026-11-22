import { useEffect, useRef, useState } from "react";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";

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
  const isCompactMode = viewport !== "wide" && !expanded && !hasText;

  useEffect(() => {
    if (expanded) {
      textareaRef.current?.focus();
    }
  }, [expanded]);

  const handleSend = () => {
    const body = composeStore.quickReplyText.trim();
    if (!body) return;
    sendMailWithUndo({
      accountId: mail.accountId,
      to: [`${mail.senderName} <${mail.senderEmail}>`],
      subject: `Re: ${mail.subject.replace(/^Re:\s*/i, "")}`,
      body,
    });
    composeStore.setQuickReplyText("");
    setExpanded(false);
  };

  if (isCompactMode) {
    return (
      <div className="quick-reply-wrap">
        <div className="quick-reply-compact" onClick={() => setExpanded(true)}>
          <div className="row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
            <Icon name="reply" size={14} />
            <input
              type="text"
              readOnly
              className="quick-reply-compact-input"
              onFocus={() => setExpanded(true)}
              value=""
              placeholder={`回复 ${mail.senderName}（锁定${account?.name ?? "工作邮箱"} · ${account?.providerLabel ?? "Gmail"}）…`}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={{ height: 28, padding: "0 12px", flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            发送
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quick-reply-wrap">
      <div className="quick-reply-box">
        <div className="row-between" style={{ gap: 8 }}>
          <span
            className="truncate"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-ink)",
              minWidth: 0,
            }}
          >
            <Icon name="reply" size={14} />
            <span className="truncate">回复 {mail.senderName}</span>
          </span>

          <div className="row" style={{ gap: 6, flexShrink: 0 }}>
            <span className="pill pill-neutral quick-reply-lock-pill">
              <ProviderIcon
                provider={account?.provider ?? mail.provider}
                size={15}
              />
              <span className="truncate">
                通过 {account?.name ?? "工作邮箱"} ·{" "}
                {account?.providerLabel ?? "Gmail"} 发送
              </span>
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
        </div>

        <textarea
          ref={textareaRef}
          className="quick-reply-textarea"
          value={composeStore.quickReplyText}
          onChange={(e) => composeStore.setQuickReplyText(e.target.value)}
          onBlur={() => {
            if (viewport !== "wide" && !composeStore.quickReplyText.trim()) {
              setExpanded(false);
            }
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
            <button
              type="button"
              className="icon-btn"
              style={{ width: 26, height: 26, flexShrink: 0 }}
              title="完整回复窗口并添加附件"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                composeStore.openReplyCompose(
                  mail,
                  "reply",
                  workspace.settings.lockReplyToOriginalAccount,
                )
              }
            >
              <Icon name="paperclip" size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{
                width: 26,
                height: 26,
                color: "var(--brand-ai)",
                flexShrink: 0,
              }}
              title="使用 Omni AI 起草回复"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                requestAiAction(
                  "起草更正式回复",
                  "请用更正式语气帮我起草一封回复",
                )
              }
            >
              <Icon name="sparkle" size={14} />
            </button>
            <span className="text-xs text-muted truncate">
              回复自动锁定原收件账户，避免发错身份
            </span>
          </div>

          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            {viewport === "wide" && <span className="kbd">Ctrl + Enter</span>}
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
  );
}
