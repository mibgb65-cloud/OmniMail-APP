import { useApp } from "../../state/AppContext";
import type { AiChatTurn, AiMailInsight } from "../../types/workspace";
import { useTranslation } from "../mail/translation/TranslationContext";
import {
  isLanguage,
  languageCode,
  languages,
} from "../mail/translation/translationLanguages";
import { analysisPrompt } from "./aiAnalysisPrompt";
import { AiMarkdown } from "./AiMarkdown";

interface AiInsightContentProps {
  insight: AiMailInsight;
  chats: AiChatTurn[];
  busy: boolean;
}

export function AiInsightContent({
  insight,
  chats,
  busy,
}: AiInsightContentProps) {
  const { composeStore, toastStore, requestAiAction, workspace } = useApp();
  const t = useTranslation();
  const ui = workspace.settings.language === "en-US" ? "en" : "zh-CN";
  const draftLanguage = isLanguage(insight.draftLanguage)
    ? insight.draftLanguage
    : undefined;
  const source =
    t.confirmedSource !== "auto"
      ? t.confirmedSource
      : (draftLanguage ?? t.language);
  const foreign = Boolean(t.result) || (source !== "auto" && source !== ui);
  const outputLanguage = isLanguage(insight.summaryLanguage)
    ? insight.summaryLanguage
    : ui;
  const generationNeeded =
    insight.draftTag === "待生成" ||
    Boolean(foreign && t.mailId && insight.summaryLanguage !== ui);
  const canInsert =
    Boolean(insight.draftReply) && (!foreign || Boolean(draftLanguage));
  const insertLabel =
    !foreign || !draftLanguage
      ? "插入回复框"
      : draftLanguage === "en"
        ? "插入英文草稿"
        : `插入${languages[draftLanguage]}草稿`;
  const quickActions = foreign
    ? [
        [
          "生成发布说明",
          "请基于原文提取版本、变更与风险，生成简洁发布说明；若不是发布相关邮件，请说明。",
        ],
        [
          "解释专业术语",
          "请用界面语言解释原文中的重要术语，并引用对应原文短语。",
        ],
      ]
    : [
        [
          "提炼待办事项",
          "请从原文提炼待办事项、负责人和截止时间；未说明时请标明。",
        ],
        ["调整为更正式语气", analysisPrompt("formal", t.confirmedSource)],
      ];

  return (
    <>
      <div className="ai-card">
        <div className="ai-card-head">
          <span>{foreign ? "外文邮件核心摘要" : insight.summaryTitle}</span>
          <span className="pill pill-ai">
            {foreign && source !== "auto"
              ? `${languageCode(source)} → ${languageCode(outputLanguage)}`
              : insight.draftTag}
          </span>
        </div>
        <p className="ai-card-text">{insight.summary}</p>
        {generationNeeded && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            style={{ marginTop: 8, width: "100%" }}
            onClick={() =>
              requestAiAction(
                "总结当前邮件",
                analysisPrompt("initial", t.confirmedSource),
              )
            }
          >
            {foreign
              ? "总结外文邮件并按原文语言拟稿"
              : "总结当前邮件并起草建议回复"}
          </button>
        )}
      </div>

      {insight.deadlines.length > 0 && (
        <div className="ai-card">
          <div className="ai-card-head">
            <span>{foreign ? "关键信息与待办" : "关键时间与待办"}</span>
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
          <span className="text-xs text-muted">
            {foreign && draftLanguage
              ? `${languages[draftLanguage]} · 人工确认后发送`
              : "人工确认后发送"}
          </span>
        </div>
        <p className="ai-card-text" style={{ whiteSpace: "pre-line" }}>
          {insight.draftReply}
        </p>
        <div className="row ai-draft-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canInsert}
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
            {insertLabel}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() =>
              requestAiAction(
                "换个语气",
                analysisPrompt(
                  insight.draftTone === "formal" ? "friendly" : "formal",
                  t.confirmedSource,
                ),
              )
            }
          >
            换个语气
          </button>
        </div>
      </div>

      <div className="ai-quick-actions">
        {quickActions.map(([label, prompt]) => (
          <button
            key={label}
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => requestAiAction(label, prompt)}
          >
            {label}
          </button>
        ))}
      </div>

      {chats.map((turn) => (
        <div key={turn.id} className={`ai-chat-bubble ${turn.role}`}>
          {turn.role === "assistant" ? (
            <AiMarkdown text={turn.content} />
          ) : (
            turn.content
          )}
        </div>
      ))}
    </>
  );
}
