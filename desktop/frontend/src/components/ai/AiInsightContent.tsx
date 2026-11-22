import { useApp } from "../../state/AppContext";
import type { AiChatTurn, AiMailInsight } from "../../types/workspace";

interface AiInsightContentProps {
  insight: AiMailInsight;
  chats: AiChatTurn[];
}

export function AiInsightContent({ insight, chats }: AiInsightContentProps) {
  const { composeStore, toastStore, requestAiAction } = useApp();

  return (
    <>
      <div className="ai-card">
        <div className="ai-card-head">
          <span>{insight.summaryTitle}</span>
          <span className="pill pill-ai">{insight.draftTag}</span>
        </div>
        <p className="ai-card-text">{insight.summary}</p>
      </div>

      {insight.deadlines.length > 0 && (
        <div className="ai-card">
          <div className="ai-card-head">
            <span>关键时间与待办</span>
            <span className="text-xs text-muted">
              {insight.deadlines.length} 项
            </span>
          </div>
          {insight.deadlines.map((d) => (
            <div key={`${d.timeText}-${d.label}`} className="ai-deadline-row">
              <span className="truncate">{d.label}</span>
              <strong
                style={{
                  color: d.urgent
                    ? "var(--status-danger)"
                    : "var(--brand-accent)",
                  flexShrink: 0,
                }}
              >
                {d.timeText}
              </strong>
            </div>
          ))}
        </div>
      )}

      <div className="ai-card ai-card-tinted">
        <div className="ai-card-head">
          <span>建议回复草稿</span>
          <span className="text-xs text-muted">人工确认后发送</span>
        </div>
        <p className="ai-card-text" style={{ whiteSpace: "pre-line" }}>
          {insight.draftReply}
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={() => {
              composeStore.setQuickReplyText(insight.draftReply);
              toastStore.pushToast({
                tone: "success",
                title: "已插入底部快速回复框",
                detail: "请人工核对收件账户与正文内容后再发送",
              });
            }}
          >
            插入回复框
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              requestAiAction("重新生成回复", "重新生成一版更简明的回复")
            }
          >
            重新生成
          </button>
        </div>
      </div>

      <div className="ai-quick-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => requestAiAction("翻译邮件", "翻译此封邮件为英文")}
        >
          翻译此封邮件
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => requestAiAction("调整语气", "调整为更正式语气")}
        >
          更正式语气
        </button>
      </div>

      {chats.map((turn) => (
        <div key={turn.id} className={`ai-chat-bubble ${turn.role}`}>
          <div style={{ whiteSpace: "pre-line" }}>{turn.content}</div>
        </div>
      ))}
    </>
  );
}
