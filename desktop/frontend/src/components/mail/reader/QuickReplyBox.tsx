import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { originalReplyAction } from "../../ai/aiAnalysisPrompt";
import { Icon } from "../../common/Icon";
import { FadeTextarea } from "../../common/scroll-fade/FadeTextarea";
import { Tooltip } from "../../common/Tooltip";
import { QuickReplyHeader } from "./QuickReplyHeader";

const iconBtnStyle = { width: 26, height: 26, flexShrink: 0 };
const aiBtnStyle = { width: 26, height: 26, color: "var(--brand-ai)" };

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
  const showCollapse = viewport !== "wide" && !hasText;

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

  const fullComposeTip = t("reader.quickReplyFullComposeTip");
  const aiDraftTip = t("reader.quickReplyAiDraftTip");

  return (
    <div className="quick-reply-wrap">
      <div className={isOpen ? "quick-reply-box" : "quick-reply-compact"}>
        <QuickReplyHeader
          senderName={mail.senderName}
          account={account}
          fallbackProvider={mail.provider}
          isOpen={isOpen}
          showCollapse={showCollapse}
          onExpand={() => setExpanded(true)}
          onCollapse={() => setExpanded(false)}
        />

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
                </Tooltip>
                <Tooltip label={aiDraftTip} placement="top">
                  <button
                    type="button"
                    className="icon-btn"
                    style={aiBtnStyle}
                    aria-label={aiDraftTip}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      app.requestAiAction(
                        t("ai.generateReplyDraft"),
                        originalReplyAction(),
                      )
                    }
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
