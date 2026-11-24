import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { useState } from "react";
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
  const ui = workspace.settings.language === "en-US" ? "en" : "zh-CN";
  const crossLang =
    Boolean(t.result) || (t.language !== "auto" && t.language !== ui);
  const blocked =
    !!mail &&
    (mail.folder === "spam" ||
      mail.folder === "trash" ||
      mail.securityWarning?.level === "danger" ||
      aiStore.sensitive.has(mail.id));
  const isDisabledForMail = !workspace.settings.aiEnabled || !mail || blocked;
  useAiMailOnOpen(open, blocked);

  const handleSendPrompt = () => {
    const trimmed = promptInput.trim();
    if (!trimmed || busy || isDisabledForMail) return;
    requestAiAction("自由提问", { kind: "chat", question: trimmed });
    setPromptInput("");
  };

  return (
    <aside
      id="mail-ai-pane"
      className="panel-card ai-pane ai-slide-panel"
      aria-label="Omni AI 助手面板"
    >
      <AiResizeHandle {...resize} />
      <div className="ai-header">
        <div className="ai-title" style={{ minWidth: 0 }}>
          <Icon name="sparkle" size={15} />
          <span className="truncate">Omni AI</span>
          {isDrawer && <span className="ai-drawer-badge">浮层抽屉</span>}
        </div>
        <div className="row" style={{ gap: 4, flexShrink: 0 }}>
          <Tooltip label="重新总结当前邮件">
            <button
              type="button"
              className="btn-icon"
              style={{ width: 26, height: 26 }}
              disabled={isDisabledForMail || busy}
              aria-label="重新总结当前邮件"
              onClick={() =>
                requestAiAction("重新总结当前邮件", summaryAction(source, true))
              }
            >
              <Icon name="refresh" size={13} />
            </button>
          </Tooltip>
          <Tooltip label="AI 隐私与模型设置">
            <button
              type="button"
              className="btn-icon"
              style={{ width: 26, height: 26 }}
              aria-label="AI 隐私与模型设置"
              onClick={() =>
                workspace.setOverlay({ type: "settings", tab: "ai" })
              }
            >
              <Icon name="sliders" size={13} />
            </button>
          </Tooltip>
          <Tooltip label="收起 AI 侧栏" shortcut="Esc">
            <button
              type="button"
              className="btn-icon"
              style={{ width: 26, height: 26 }}
              aria-label="收起 AI 侧栏"
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
        label="AI 分析和对话"
        viewportProps={chatViewport}
      >
        {isDisabledForMail ? (
          <div className="ai-status-box warning">
            <strong>
              {!workspace.settings.aiEnabled
                ? "Omni AI 助手已停用"
                : !mail
                  ? "未选中任何邮件"
                  : "敏感邮件已跳过"}
            </strong>
            <div style={{ lineHeight: 1.5 }}>
              {!workspace.settings.aiEnabled
                ? "你可以随时在「设置 → AI 助手」中重新开启。"
                : !mail
                  ? "打开邮件后可查看摘要、拟稿或追问。"
                  : "未向模型发送此邮件。验证码、私钥、禁读邮件和高风险邮件均不可调用 AI。"}
            </div>
          </div>
        ) : (
          <>
            <AiStatusPanel
              status={result?.status ?? "idle"}
              detail={result?.detail ?? ""}
              onRetry={() => {
                if (result?.run)
                  requestAiAction("重试当前操作", result.run.action);
              }}
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
            placeholder={
              isDisabledForMail
                ? "当前邮件不可调用 AI"
                : crossLang
                  ? ui === "en"
                    ? "Ask in English about the original…"
                    : "用中文追问这封外文邮件的细节…"
                  : "针对这封邮件，问点什么…"
            }
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ height: 26, padding: "0 10px", flexShrink: 0 }}
            disabled={isDisabledForMail || busy || !promptInput.trim()}
            onClick={handleSendPrompt}
          >
            发送
          </button>
        </div>
        <div className="ai-footnote">
          每封邮件在本地保留最近 10 轮对话 · AI 内容仅供参考
        </div>
      </div>
    </aside>
  );
}
