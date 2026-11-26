import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import type { DarkHtmlMode } from "../../../types/settings";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { LabelPickerPopover } from "../LabelPickerPopover";
import { ReaderTranslateButton } from "../translation/ReaderTranslateButton";
import { HtmlThemeModeToggle } from "./HtmlThemeModeToggle";
import { ReaderMoreMenu } from "./ReaderMoreMenu";
import { getReaderToolbarSlotStyles } from "./readerToolbarLayout";
import {
  READER_LABEL_SHORTCUT_EVENT,
  useReaderLabelShortcut,
  useReaderToolbarActions,
} from "./useReaderToolbarActions";
import { useReaderToolbarLayout } from "./useReaderToolbarLayout";

export { READER_LABEL_SHORTCUT_EVENT };

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
  const labelBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);

  const toggleAnchor = useCallback((target: HTMLElement | null) => {
    setLabelAnchor((prev) => (prev ? null : target));
  }, []);

  const { actions, handleDelete } = useReaderToolbarActions(mail, (el) =>
    toggleAnchor(el ?? labelBtnRef.current ?? moreBtnRef.current ?? null),
  );
  useReaderLabelShortcut(labelBtnRef, moreBtnRef, ref, toggleAnchor);

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
        {visibleActions.map((act) => {
          const isLabel = act.id === "label";
          const isOpen = isLabel && labelAnchor !== null;
          return (
            <button
              key={act.id}
              ref={isLabel ? labelBtnRef : undefined}
              type="button"
              aria-expanded={isLabel ? isOpen : undefined}
              className={`btn btn-sm btn-secondary reader-act-btn${isOpen ? " is-label-open" : ""}`}
              aria-label={act.label}
              title={layout.density === "icons" ? act.label : undefined}
              onMouseDown={isLabel ? (e) => e.stopPropagation() : undefined}
              onClick={(e) => act.onSelect(e.currentTarget)}
            >
              {act.icon && <Icon name={act.icon} size={13} />}
              <span>{act.label}</span>
            </button>
          );
        })}
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
          triggerRef={moreBtnRef}
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

      {labelAnchor && (
        <LabelPickerPopover
          mailIds={[mail.id]}
          anchorEl={labelAnchor}
          onClose={() => setLabelAnchor(null)}
        />
      )}
    </div>
  );
}
