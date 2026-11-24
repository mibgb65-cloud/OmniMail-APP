import { useApp } from "../../state/AppContext";
import type { AiMailInsight } from "../../types/workspace";
import {
  languageCode,
  type SourceLanguage,
} from "../mail/translation/translationLanguages";
import { summaryAction } from "./aiAnalysisPrompt";
import { hasUsableSummary } from "./autoMailSummary";

export function AiSummaryCard({
  insight,
  busy,
  source,
  foreignLanguage,
  uiLanguage,
}: {
  insight: AiMailInsight | null;
  busy: boolean;
  source: SourceLanguage;
  foreignLanguage?: SourceLanguage;
  uiLanguage: "en" | "zh-CN";
}) {
  const { requestAiAction } = useApp();
  const ready = hasUsableSummary(insight, uiLanguage);

  return (
    <section className="ai-card" aria-label="邮件摘要">
      <div className="ai-card-head">
        <span>
          {ready && foreignLanguage ? "外文邮件核心摘要" : "邮件摘要"}
        </span>
        {foreignLanguage && (
          <span className="pill pill-ai">
            {languageCode(foreignLanguage)} → {languageCode(uiLanguage)}
          </span>
        )}
      </div>
      {ready ? (
        <>
          {insight.summaryTitle && (
            <strong className="ai-card-text">{insight.summaryTitle}</strong>
          )}
          <p className="ai-card-text">{insight.summary}</p>
          {insight.deadlines.length > 0 && (
            <div className="ai-card-head">关键时间与待办</div>
          )}
          {insight.deadlines.map((item, index) => (
            <div key={index} className="ai-deadline-row">
              <span className="truncate">{item.label}</span>
              <strong
                style={{
                  color: item.urgent
                    ? "var(--status-danger)"
                    : "var(--brand-accent)",
                  flexShrink: 0,
                }}
              >
                {item.timeText}
              </strong>
            </div>
          ))}
          {insight.cached && (
            <span className="text-xs text-muted">本地缓存 · 零重复消耗</span>
          )}
        </>
      ) : (
        <>
          <p className="ai-card-text">
            提炼核心主旨、关键时间与待办事项，外文邮件以界面语言输出。
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() =>
              requestAiAction("总结当前邮件", summaryAction(source))
            }
          >
            总结当前邮件
          </button>
        </>
      )}
    </section>
  );
}
