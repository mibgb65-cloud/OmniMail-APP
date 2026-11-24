import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import type { DarkHtmlMode } from "../../../types/settings";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { ReaderTranslateButton } from "../translation/ReaderTranslateButton";
import { HtmlThemeModeToggle } from "./HtmlThemeModeToggle";
import { ReaderMoreMenu } from "./ReaderMoreMenu";
import { getReaderToolbarSlotStyles } from "./readerToolbarLayout";
import { useReaderToolbarActions } from "./useReaderToolbarActions";
import { useReaderToolbarLayout } from "./useReaderToolbarLayout";

export function ReaderToolbar({
  mail,
  currentIndex,
  totalCount,
  scrolled = false,
  showHtmlThemeToggle = false,
  htmlThemeMode = "adaptive",
  onHtmlThemeModeChange,
  onNavigate,
}: {
  mail: MailItem;
  currentIndex: number;
  totalCount: number;
  scrolled?: boolean;
  showHtmlThemeToggle?: boolean;
  htmlThemeMode?: DarkHtmlMode;
  onHtmlThemeModeChange?: (mode: DarkHtmlMode) => void;
  onNavigate: (delta: -1 | 1) => void;
}) {
  const { lang, t } = useI18n();
  const { workspace, aiStore } = useApp();
  const reservedToggleWidth = showHtmlThemeToggle
    ? lang === "en-US"
      ? 206
      : 162
    : 0;
  const { ref, layout } = useReaderToolbarLayout(reservedToggleWidth);
  const { actions, handleDelete } = useReaderToolbarActions(mail);
  const aiLabel = t(aiStore.aiOpen ? "reader.hideAi" : "reader.showAi");
  const deleteTip = t(
    mail.folder === "trash"
      ? "reader.permanentDeleteTip"
      : "reader.moveToTrashTip",
  );
  const visibleActions = actions.filter((a) => layout.actions.includes(a.id));
  const foldedActions = actions.filter((a) => !layout.actions.includes(a.id));
  const navText = `${currentIndex + 1} / ${totalCount}`;

  return (
    <div
      ref={ref}
      className="reader-toolbar"
      style={getReaderToolbarSlotStyles(lang)}
      data-scrolled={scrolled}
      data-tool-density={layout.density}
      data-ai-label={layout.aiLabel}
    >
      <div className="reader-toolbar-group">
        {visibleActions.map((act) => (
          <button
            key={act.id}
            type="button"
            className="btn btn-sm btn-secondary reader-act-btn"
            aria-label={act.label}
            title={layout.density === "icons" ? act.label : undefined}
            onClick={act.onSelect}
          >
            {act.icon && <Icon name={act.icon} size={13} />}
            <span>{act.label}</span>
          </button>
        ))}
        <ReaderTranslateButton key={mail.id} />
        {showHtmlThemeToggle && onHtmlThemeModeChange && (
          <HtmlThemeModeToggle
            mode={htmlThemeMode}
            iconOnly={layout.density === "icons"}
            onChange={onHtmlThemeModeChange}
          />
        )}
        {layout.showDelete && (
          <Tooltip label={deleteTip} shortcut="Del">
            <button
              type="button"
              className="icon-btn icon-btn-bordered reader-icon-btn"
              onClick={handleDelete}
              aria-label={t("reader.deleteMailAria")}
            >
              <Icon name="trash" size={13} />
            </button>
          </Tooltip>
        )}
        <ReaderMoreMenu
          mail={mail}
          onDelete={handleDelete}
          foldedItems={foldedActions}
        />
      </div>

      <div className="reader-toolbar-group reader-toolbar-nav">
        {layout.showCount && totalCount > 0 && (
          <span className="reader-nav-count" title={navText}>
            {navText}
          </span>
        )}
        <Tooltip label={t("reader.prevMailTip")} shortcut="K">
          <button
            type="button"
            className="icon-btn icon-btn-bordered reader-icon-btn"
            disabled={currentIndex <= 0}
            onClick={() => onNavigate(-1)}
            aria-label={t("reader.prevMailTip")}
          >
            <Icon name="chevronLeft" size={13} />
          </button>
        </Tooltip>
        <Tooltip label={t("reader.nextMailTip")} shortcut="J">
          <button
            type="button"
            className="icon-btn icon-btn-bordered reader-icon-btn"
            disabled={currentIndex >= totalCount - 1}
            onClick={() => onNavigate(1)}
            aria-label={t("reader.nextMailTip")}
          >
            <Icon name="chevronRight" size={13} />
          </button>
        </Tooltip>
        <button
          type="button"
          id="mail-ai-toggle"
          className="btn btn-sm btn-ai reader-ai-toggle"
          aria-controls="mail-ai-pane"
          aria-expanded={aiStore.aiOpen}
          aria-label={aiLabel}
          title={layout.aiLabel === "full" ? undefined : aiLabel}
          onClick={() => {
            workspace.setLeftNavOpen(false);
            aiStore.setAiOpen((v) => !v);
          }}
        >
          <Icon name="sparkle" size={13} />
          <span hidden={layout.aiLabel === "icon"}>
            {layout.aiLabel === "short" ? "AI" : aiLabel}
          </span>
        </button>
      </div>
    </div>
  );
}
