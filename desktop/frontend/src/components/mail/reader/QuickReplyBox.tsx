import { FadeTextarea } from "../../common/scroll-fade/FadeTextarea";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { originalReplyAction } from "../../ai/aiAnalysisPrompt";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";
import { Tooltip } from "../../common/Tooltip";

const iconBtnStyle = { width: 26, height: 26, flexShrink: 0 };
const aiBtnStyle = { width: 26, height: 26, color: "var(--brand-ai)" };
const compactBtnStyle = { height: 28, padding: "0 12px", flexShrink: 0 };

export function QuickReplyBox({ mail }: { mail: MailItem }) {
  const { t } = useI18n();
  const app = useApp();
  const { viewport, workspace, composeStore } = app;
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
    app.sendMailWithUndo({
      accountId: mail.accountId,
      to: [`${mail.senderName} <${mail.senderEmail}>`],
      subject: `Re: ${mail.subject.replace(/^Re:\s*/i, "")}`,
      body,
      replyToMailId: mail.id,
    });
    composeStore.setQuickReplyText("");
    setExpanded(false);
  };

  const senderLabel = `${account?.name ?? t("reader.quickReplyDefaultAccount")} · ${account?.providerLabel ?? "IMAP"}`;
  const replyLock = workspace.settings.lockReplyToOriginalAccount;
  const openFullReply = () =>
    composeStore.openReplyCompose(mail, "reply", replyLock);
  const draftAiReply = () =>
    app.requestAiAction(t("ai.generateReplyDraft"), originalReplyAction());
  const headerStyle = {
    gap: 8,
    flex: 1,
    minWidth: 0,
    cursor: isOpen ? "default" : "text",
  };
  const titleStyle = {
    fontSize: 13,
    fontWeight: isOpen ? 600 : 400,
    color: isOpen ? "var(--text-ink)" : "var(--text-muted)",
  };
  const fullComposeTip = t("reader.quickReplyFullComposeTip");
  const aiDraftTip = t("reader.quickReplyAiDraftTip");
  const provider = account?.provider ?? mail.provider;
  const sendViaText = t("reader.quickReplySendVia", { account: senderLabel });
  const headerTitle = isOpen
    ? t("reader.quickReplyOpenHeader", { sender: mail.senderName })
    : t("reader.quickReplyCollapsedHeader", {
        sender: mail.senderName,
        account: senderLabel,
      });

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
            <span className="truncate" style={titleStyle}>
              {headerTitle}
            </span>
          </span>

          {isOpen ? (
            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
              <span className="pill pill-neutral quick-reply-lock-pill">
                <ProviderIcon provider={provider} size={15} />
                <span className="truncate">{sendViaText}</span>
                <Icon name="lock" size={11} />
              </span>
              {viewport !== "wide" && !hasText && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpanded(false)}
                >
                  {t("reader.quickReplyCollapse")}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={compactBtnStyle}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
            >
              {t("reader.reply")}
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
              aria-label={t("reader.quickReplyAria")}
              tabIndex={isOpen ? 0 : -1}
              className="quick-reply-textarea"
              value={composeStore.quickReplyText}
              onChange={(e) => composeStore.setQuickReplyText(e.target.value)}
              onBlur={() => {
                if (viewport !== "wide" && !composeStore.quickReplyText.trim())
                  setExpanded(false);
              }}
              placeholder={t("reader.quickReplyPlaceholder")}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div className="row-between" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 6, minWidth: 0 }}>
                <Tooltip label={fullComposeTip} placement="top">
                  <button
                    type="button"
                    className="icon-btn"
                    style={iconBtnStyle}
                    aria-label={fullComposeTip}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openFullReply}
                  >
                    <Icon name="paperclip" size={14} />
                  </button>
                </Tooltip>
                <Tooltip label={aiDraftTip} placement="top">
                  <button
                    type="button"
                    className="icon-btn"
                    style={aiBtnStyle}
                    aria-label={aiDraftTip}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={draftAiReply}
                  >
                    <Icon name="sparkle" size={14} />
                  </button>
                </Tooltip>
                <span className="text-xs text-muted truncate">
                  {t("reader.quickReplyLockHint")}
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
                  <span>{t("reader.sendBtn")}</span>
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
