import type { AiMailInsight } from "../../types/workspace";

type SummaryFields = Pick<AiMailInsight, "summary" | "summaryLanguage">;

export function hasUsableSummary<T extends SummaryFields>(
  insight: T | null | undefined,
  uiLanguage?: string,
): insight is T {
  return Boolean(
    insight?.summary.trim() &&
    (!uiLanguage ||
      !insight.summaryLanguage ||
      insight.summaryLanguage === uiLanguage),
  );
}

export function scheduleAutoMailSummary(
  cache: Promise<SummaryFields | null | undefined>,
  uiLanguage: string,
  start: () => void,
) {
  let cancelled = false;
  const timer = setTimeout(() => {
    void cache.then(
      (insight) => {
        if (
          !cancelled &&
          insight !== undefined &&
          !hasUsableSummary(insight, uiLanguage)
        )
          start();
      },
      () => undefined,
    );
  }, 300);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
