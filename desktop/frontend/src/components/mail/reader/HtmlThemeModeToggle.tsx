import { useI18n } from "../../../i18n";
import type { DarkHtmlMode } from "../../../types/settings";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";

export function HtmlThemeModeToggle({
  mode,
  iconOnly = false,
  onChange,
}: {
  mode: DarkHtmlMode;
  iconOnly?: boolean;
  onChange: (next: DarkHtmlMode) => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className={`reader-html-mode-seg${iconOnly ? " is-icon-only" : ""}`}
      role="group"
      aria-label={t("reader.htmlThemeToggleAria")}
    >
      <Tooltip label={t("reader.htmlThemeAdaptiveTip")}>
        <button
          type="button"
          className={`reader-html-mode-btn${mode === "adaptive" ? " active" : ""}`}
          aria-pressed={mode === "adaptive"}
          aria-label={t("reader.htmlThemeAdaptive")}
          onClick={() => onChange("adaptive")}
        >
          <Icon name="moon" size={12} />
          {!iconOnly && <span>{t("reader.htmlThemeAdaptive")}</span>}
        </button>
      </Tooltip>
      <Tooltip label={t("reader.htmlThemePaperTip")}>
        <button
          type="button"
          className={`reader-html-mode-btn${mode === "paper" ? " active" : ""}`}
          aria-pressed={mode === "paper"}
          aria-label={t("reader.htmlThemePaper")}
          onClick={() => onChange("paper")}
        >
          <Icon name="sun" size={12} />
          {!iconOnly && <span>{t("reader.htmlThemePaper")}</span>}
        </button>
      </Tooltip>
    </div>
  );
}
