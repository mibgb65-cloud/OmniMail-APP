import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import type { ActionMenuEntry } from "../../common/ActionMenu";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { ReaderTranslateButton } from "../translation/ReaderTranslateButton";
import { ReaderMoreMenu } from "./ReaderMoreMenu";
import {
  getReaderToolbarSlotStyles,
  type ReaderActionId,
} from "./readerToolbarLayout";
import { useReaderToolbarLayout } from "./useReaderToolbarLayout";

export function ReaderToolbar({
  mail,
  currentIndex,
  totalCount,
  scrolled = false,
  onNavigate,
}: {
  mail: MailItem;
  currentIndex: number;
  totalCount: number;
  scrolled?: boolean;
  onNavigate: (delta: -1 | 1) => void;
}) {
  const { lang, t, localizeText } = useI18n();
  const { workspace, mailStore, composeStore, aiStore, toastStore } = useApp();
  const { ref, layout } = useReaderToolbarLayout();
  const aiLabel = t(aiStore.aiOpen ? "reader.hideAi" : "reader.showAi");
  const deleteTip = t(
    mail.folder === "trash"
      ? "reader.permanentDeleteTip"
      : "reader.moveToTrashTip",
  );
  const replyLock = workspace.settings.lockReplyToOriginalAccount;
  const actions: Array<
    Extract<ActionMenuEntry, { label: string }> & { id: ReaderActionId }
  > = [
    {
      id: "reply",
      icon: "reply",
      label: t("reader.reply"),
      onSelect: () => composeStore.openReplyCompose(mail, "reply", replyLock),
    },
    {
      id: "forward",
      icon: "forward",
      label: t("reader.forward"),
      shortcut: "F",
      onSelect: () => composeStore.openReplyCompose(mail, "forward", false),
    },
    {
      id: "archive",
      icon: "archive",
      label: t("reader.archive"),
      onSelect: () => {
        mailStore.moveMails([mail.id], "archive");
        toastStore.pushToast({ tone: "info", title: t("toasts.mailArchived") });
      },
    },
    {
      id: "snooze",
      icon: "clock",
      label: t("reader.snooze"),
      shortcut: "H",
      onSelect: () =>
        workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
    },
    {
      id: "label",
      icon: "tag",
      label: t("reader.label"),
      shortcut: "L",
      onSelect: () =>
        workspace.setOverlay({
          type: "label-manage",
          mailIds: [mail.id],
          mode: "assign",
        }),
    },
  ];

  const handleDelete = () => {
    if (mail.folder === "trash") {
      const targetLabel = mail.subject.trim()
        ? localizeText(mail.subject)
        : t("common.noSubject");
      workspace.setOverlay({
        type: "danger-confirm",
        kind: "permanent-delete",
        targetId: mail.id,
        targetLabel,
      });
      return;
    }
    mailStore.moveMails([mail.id], "trash");
    toastStore.pushToast({ tone: "info", title: t("toasts.movedToTrash") });
  };

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
