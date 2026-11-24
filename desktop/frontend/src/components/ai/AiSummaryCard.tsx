import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { AiMailInsight } from "../../types/workspace";
import {
  languageCode,
  type SourceLanguage,
} from "../mail/translation/translationLanguages";
import { summaryAction } from "./aiAnalysisPrompt";
import { hasUsableSummary, normalizeSummaryDeadlines } from "./autoMailSummary";

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
  const { t } = useI18n();
  const { requestAiAction } = useApp();
  const ready = hasUsableSummary(insight, uiLanguage);
  const deadlines = ready ? normalizeSummaryDeadlines(insight.deadlines) : [];
  const summarizeLabel = t("ai.summarizeEmail");

  return (
    <section className="ai-card" aria-label={t("ai.emailSummary")}>
      <div className="ai-card-head">
        <span>
          {t(
            ready && foreignLanguage
              ? "ai.foreignEmailSummary"
              : "ai.emailSummary",
          )}
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
          {deadlines.length > 0 && (
            <div className="ai-card-head">{t("ai.keyDatesAndTasks")}</div>
          )}
          {deadlines.map((item, index) => (
            <div key={index} className="ai-deadline-row ai-summary-deadline">
              {item.label && (
                <span className="ai-deadline-label">{item.label}</span>
              )}
              {item.timeText && (
                <strong
                  className="ai-deadline-time"
                  data-urgent={item.urgent ? "true" : undefined}
                >
                  {item.timeText}
                </strong>
              )}
            </div>
          ))}
          {insight.cached && (
            <span className="text-xs text-muted">{t("ai.cachedZeroCost")}</span>
          )}
        </>
      ) : (
        <>
          <p className="ai-card-text">{t("ai.summaryIntro")}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() =>
              requestAiAction(summarizeLabel, summaryAction(source))
            }
          >
            {summarizeLabel}
          </button>
        </>
      )}
    </section>
  );
}
