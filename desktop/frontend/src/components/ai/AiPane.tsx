import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { AiInsightContent } from "./AiInsightContent";
import { AiResizeHandle, type AiResizeHandleProps } from "./AiResizeHandle";
import { AiStatusPanel } from "./AiStatusPanel";
import { summaryAction } from "./aiAnalysisPrompt";
import { AiPrivacyBadge } from "./AiPrivacyBadge";
import { useTranslation } from "../mail/translation/TranslationContext";
import { useAiChatScroll } from "./useAiChatScroll";
import { useAiMailOnOpen } from "./useAiMailOnOpen";

const hdrBtnStyle = { width: 26, height: 26 };
const sendBtnStyle = { height: 26, padding: "0 10px", flexShrink: 0 };

export function AiPane({
  isDrawer,
  open,
  onClose,
  resize,
}: {
  isDrawer: boolean;
  open: boolean;
  onClose: () => void;
  resize: AiResizeHandleProps;
}) {
  const { isEn, t: tr } = useI18n();
  const { workspace, mailStore, aiStore, requestAiAction } = useApp();
  const mail = mailStore.selectedMail;
  const mailId = mail?.id;
  const [prompt, setPrompt] = useState({ mailId, text: "" });
  const promptInput = prompt.mailId === mailId ? prompt.text : "";
  const setPromptInput = (text: string) => setPrompt({ mailId, text });
  const insight = aiStore.getInsight(mail);
  const chats = aiStore.getChats(mailId);
  const chatViewport = useAiChatScroll(
    mailId,
    aiStore.pendingMailId === mailId ? aiStore.pendingRequestId : undefined,
    chats.at(-1),
  );
  const result =
    aiStore.result.run?.mailId === mailId ? aiStore.result : undefined;
  const busy = aiStore.result.status === "processing";
  const t = useTranslation();
  const source = t.confirmedSource;
  const crossLang =
    Boolean(t.result) ||
    (t.language !== "auto" &&
      (isEn ? t.language !== "en" : !t.language.startsWith("zh")));
  const blocked =
    !!mail &&
    (mail.folder === "spam" ||
      mail.folder === "trash" ||
      mail.securityWarning?.level === "danger" ||
      aiStore.sensitive.has(mail.id));
  const isDisabledForMail = !workspace.settings.aiEnabled || !mail || blocked;
  useAiMailOnOpen(open, blocked);

  const handleSendPrompt = () => {
    const question = promptInput.trim();
    if (!question || busy || isDisabledForMail) return;
    requestAiAction(tr("ai.freeQuestionLabel"), { kind: "chat", question });
    setPromptInput("");
  };
  const resummarizeTip = tr("ai.resummarizeTip");
  const settingsTip = tr("ai.settingsTip");
  const closeTip = tr("ai.closeSidebarTip");
  const [disabledTitle, disabledDesc] = !workspace.settings.aiEnabled
    ? [tr("ai.disabledTitle"), tr("ai.disabledDesc")]
    : !mail
      ? [tr("ai.noMailTitle"), tr("ai.noMailDesc")]
      : [tr("ai.sensitiveSkippedTitle"), tr("ai.sensitiveSkippedDesc")];
  const placeholder = tr(
    isDisabledForMail
      ? "ai.askDisabledPlaceholder"
      : crossLang
        ? "ai.askForeignPlaceholder"
        : "ai.askPlaceholder",
  );
  const handleRetry = () => {
    if (result?.run)
      requestAiAction(tr("ai.retryCurrentAction"), result.run.action);
  };

  return (
    <aside
      id="mail-ai-pane"
      className="panel-card ai-pane ai-slide-panel"
      aria-label={tr("ai.paneAria")}
    >
      <AiResizeHandle {...resize} />
      <div className="ai-header">
        <div className="ai-title" style={{ minWidth: 0 }}>
          <Icon name="sparkle" size={15} />
          <span className="truncate">Omni AI</span>
          {isDrawer && (
            <span className="ai-drawer-badge">{tr("ai.drawerBadge")}</span>
          )}
        </div>
        <div className="row" style={{ gap: 4, flexShrink: 0 }}>
          <Tooltip label={resummarizeTip}>
            <button
              type="button"
              className="btn-icon"
              style={hdrBtnStyle}
              disabled={isDisabledForMail || busy}
              aria-label={resummarizeTip}
              onClick={() =>
                requestAiAction(resummarizeTip, summaryAction(source, true))
              }
            >
              <Icon name="refresh" size={13} />
            </button>
          </Tooltip>
          <Tooltip label={settingsTip}>
            <button
              type="button"
              className="btn-icon"
              style={hdrBtnStyle}
              aria-label={settingsTip}
              onClick={() =>
                workspace.setOverlay({ type: "settings", tab: "ai" })
              }
            >
              <Icon name="sliders" size={13} />
            </button>
          </Tooltip>
          <Tooltip label={closeTip} shortcut="Esc">
            <button
              type="button"
              className="btn-icon"
              style={hdrBtnStyle}
              aria-label={closeTip}
              onClick={onClose}
            >
              <Icon name="x" size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      <AiPrivacyBadge />

      <FadeScroll
        className="ai-scroll"
        surface={isDrawer ? "--bg-ai-surface" : "--bg-card"}
        label={tr("ai.scrollLabel")}
        viewportProps={chatViewport}
      >
        {isDisabledForMail ? (
          <div className="ai-status-box warning">
            <strong>{disabledTitle}</strong>
            <div style={{ lineHeight: 1.5 }}>{disabledDesc}</div>
          </div>
        ) : (
          <>
            <AiStatusPanel
              status={result?.status ?? "idle"}
              detail={result?.detail ?? ""}
              onRetry={handleRetry}
            />
            <AiInsightContent insight={insight} chats={chats} busy={busy} />
          </>
        )}
      </FadeScroll>

      <div className="ai-input-footer">
        <div className="ai-composer">
          <input
            type="text"
            value={promptInput}
            maxLength={8000}
            disabled={isDisabledForMail}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing)
                handleSendPrompt();
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={sendBtnStyle}
            disabled={isDisabledForMail || busy || !promptInput.trim()}
            onClick={handleSendPrompt}
          >
            {tr("ai.sendBtn")}
          </button>
        </div>
        <div className="ai-footnote">{tr("ai.footnote")}</div>
      </div>
    </aside>
  );
}
