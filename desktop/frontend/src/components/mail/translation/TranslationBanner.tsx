import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { useTranslation } from "./TranslationContext";
import { languages } from "./translationLanguages";
import { translationModes } from "./translationTypes";

export function TranslationBanner() {
  const t = useTranslation();
  const { workspace } = useApp();
  if (!t.result && !t.error && !t.pending) return null;
  const value = t.result?.content;
  const detectedSource =
    value && value.source !== "auto" ? value.source : t.language;
  const source =
    detectedSource === "auto" ? "自动检测" : languages[detectedSource];
  const progress =
    t.totalBatches > 0
      ? `（${t.completedBatches} / ${t.totalBatches} 批）`
      : "";
  const note = t.pending
    ? `正在翻译${progress}，仍可继续阅读`
    : t.partial
      ? `部分翻译失败${progress}，已完成的译文已保留。${t.error ?? ""}`
      : t.error ||
        `${source} → ${value ? languages[value.target] : ""} · ${
          t.mode === "original"
            ? "当前显示原文"
            : t.mode === "translated"
              ? "原地保真渲染"
              : "双语保真渲染"
        }`;
  return (
    <div className="translation-banner">
      <div className="translation-banner-status" role="status">
        <span className="pill translation-badge">
          <Icon name="language" size={14} />
          翻译
        </span>
        <span>{note}</span>
      </div>
      <div className="translation-banner-actions">
        {value && (t.pending || t.hasTranslation) && (
          <div
            className="translation-display-modes"
            role="group"
            aria-label="译文显示模式"
          >
            {translationModes.map(({ id, label }) => (
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
            重试翻译
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            workspace.setOverlay({ type: "settings", tab: "translation" })
          }
        >
          设置
        </button>
      </div>
    </div>
  );
}
