import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { useTranslation } from "./TranslationContext";
import { getLanguages } from "./translationLanguages";
import { getTranslationModes } from "./translationTypes";

export function TranslationBanner() {
  const { lang, t: tr } = useI18n();
  const t = useTranslation();
  const { workspace } = useApp();
  if (!t.result && !t.error && !t.pending) return null;
  const languageMap = getLanguages(lang);
  const modes = getTranslationModes(tr);
  const value = t.result?.content;
  const detectedSource =
    value && value.source !== "auto" ? value.source : t.language;
  const source =
    detectedSource === "auto"
      ? tr("translation.autoDetect")
      : languageMap[detectedSource];
  const progress =
    t.totalBatches > 0
      ? tr("translation.bannerBatchProgress", {
          done: t.completedBatches,
          total: t.totalBatches,
        })
      : "";
  const renderedLabel =
    t.mode === "original"
      ? tr("translation.bannerShowingOriginal")
      : t.mode === "translated"
        ? tr("translation.bannerInlineRendered")
        : tr("translation.bannerBilingualRendered");
  const note = t.pending
    ? tr("translation.bannerTranslating", { progress })
    : t.partial
      ? tr("translation.bannerPartialFailed", {
          progress,
          error: t.error ?? "",
        })
      : t.error ||
        `${source} → ${value ? languageMap[value.target] : ""} · ${renderedLabel}`;
  return (
    <div className="translation-banner">
      <div className="translation-banner-status" role="status">
        <span className="pill translation-badge">
          <Icon name="language" size={14} />
          {tr("translation.translate")}
        </span>
        <span>{note}</span>
      </div>
      <div className="translation-banner-actions">
        {value && (t.pending || t.hasTranslation) && (
          <div
            className="translation-display-modes"
            role="group"
            aria-label={tr("translation.bannerModesAria")}
          >
            {modes.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                aria-pressed={t.mode === id}
                onClick={() => t.setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {t.failed && t.result && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={t.disabled}
            onClick={() => {
              if (t.result) void t.translate(t.result.options, true);
            }}
          >
            {tr("translation.retryTranslate")}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            workspace.setOverlay({ type: "settings", tab: "translation" })
          }
        >
          {tr("translation.bannerSettingsShort")}
        </button>
      </div>
    </div>
  );
}
