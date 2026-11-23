import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { AiInsightContent } from "./AiInsightContent";
import { AiStatusPanel } from "./AiStatusPanel";

export function AiPane({
  isDrawer,
  open,
  onClose,
}: {
  isDrawer: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const { workspace, mailStore, aiStore, requestAiAction } = useApp();
  const mail = mailStore.selectedMail;
  const mailId = mail?.id;
  const [prompt, setPrompt] = useState({ mailId, text: "" });
  const promptInput = prompt.mailId === mailId ? prompt.text : "";
  const setPromptInput = (text: string) => setPrompt({ mailId, text });
  const insight = aiStore.getInsight(mail);
  const chats = mail ? (aiStore.chatsByMail[mail.id] ?? []) : [];
  const { loadCachedForMail } = aiStore;

  useEffect(() => {
    if (open && mailId) loadCachedForMail(mailId);
  }, [open, mailId, loadCachedForMail]);

  const isDisabledForMail =
    !workspace.settings.aiEnabled ||
    !mail ||
    mail.folder === "spam" ||
    mail.folder === "trash" ||
    mail.securityWarning?.level === "danger";

  const handleSendPrompt = () => {
    const trimmed = promptInput.trim();
    if (!trimmed) return;
    requestAiAction("自由提问", trimmed);
    setPromptInput("");
  };

  return (
    <aside
      id="mail-ai-pane"
      className="panel-card ai-pane ai-slide-panel"
      aria-label="Omni AI 助手面板"
    >
      <div className="ai-header">
        <div className="ai-title" style={{ minWidth: 0 }}>
          <Icon name="sparkle" size={15} />
          <span className="truncate">Omni AI</span>
          {isDrawer && <span className="ai-drawer-badge">浮层抽屉</span>}
        </div>
        <div className="row" style={{ gap: 4, flexShrink: 0 }}>
          <Tooltip label="重新分析当前邮件">
            <button
              type="button"
              className="btn-icon"
              style={{ width: 26, height: 26 }}
              disabled={isDisabledForMail}
              aria-label="重新分析当前邮件"
              onClick={() =>
                requestAiAction("重新分析邮件", "重新生成摘要与回复建议")
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

      <div className="ai-privacy-wrap">
        <button
          type="button"
          className="ai-privacy-pill"
          onClick={() => workspace.setOverlay({ type: "settings", tab: "ai" })}
        >
          <span className="row" style={{ gap: 6, minWidth: 0 }}>
            <Icon name="shield" size={13} />
            <span className="truncate">仅使用当前邮件正文 · 附件不外传</span>
          </span>
          <Icon name="chevronRight" size={12} />
        </button>
      </div>

      <div className="ai-scroll">
        <AiStatusPanel
          status={aiStore.aiStatus}
          onRetry={() =>
            requestAiAction("重试分析", "重新生成当前邮件回复建议")
          }
        />

        {isDisabledForMail ? (
          <div className="ai-status-box warning">
            <strong>
              {!workspace.settings.aiEnabled
                ? "Omni AI 助手已停用"
                : !mail
                  ? "未选中任何邮件"
                  : "已基于安全策略禁用 AI 读取"}
            </strong>
            <div style={{ lineHeight: 1.5 }}>
              {!workspace.settings.aiEnabled
                ? "你可以随时在「设置 → AI 助手」中重新开启。"
                : "垃圾邮件、回收站与疑似钓鱼风险邮件默认不向 AI 发送任何内容。"}
            </div>
          </div>
        ) : (
          <AiInsightContent insight={insight} chats={chats} />
        )}
      </div>

      <div className="ai-input-footer">
        <div className="ai-composer">
          <input
            type="text"
            value={promptInput}
            disabled={isDisabledForMail}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendPrompt();
            }}
            placeholder={
              isDisabledForMail
                ? "当前邮件不可调用 AI"
                : "针对这封邮件，问点什么…"
            }
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ height: 26, padding: "0 10px", flexShrink: 0 }}
            disabled={isDisabledForMail || !promptInput.trim()}
            onClick={handleSendPrompt}
          >
            发送
          </button>
        </div>
        <div className="ai-footnote">
          AI 内容仅供参考，发送前请确认{isDrawer ? " · Esc 收起" : ""}
        </div>
      </div>
    </aside>
  );
}
