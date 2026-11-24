import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import type { MailItem } from "../../types/mail";
import { ActionMenu, type ActionMenuEntry } from "../common/ActionMenu";

interface MailContextMenuProps {
  state: { mail: MailItem; x: number; y: number } | null;
  onClose: () => void;
}

export function MailContextMenu({ state, onClose }: MailContextMenuProps) {
  const { t, localizeText } = useI18n();
  const { workspace, mailStore, composeStore, toastStore } = useApp();
  const { rendered, closing } = useValuePresence(state, 100);
  if (!rendered) return null;
  const { mail, x, y } = rendered;

  const items: ActionMenuEntry[] = [
    {
      label: t("mailList.ctxReplySender"),
      icon: "reply",
      shortcut: "R",
      onSelect: () =>
        composeStore.openReplyCompose(
          mail,
          "reply",
          workspace.settings.lockReplyToOriginalAccount,
        ),
    },
    {
      label: t("mailList.ctxForwardMail"),
      icon: "forward",
      shortcut: "F",
      onSelect: () => composeStore.openReplyCompose(mail, "forward", false),
    },
    { type: "divider" },
    {
      label: t(
        mailStore.checkedIds.includes(mail.id)
          ? "mailList.ctxUnselect"
          : "mailList.ctxBatchSelect",
      ),
      icon: "check",
      onSelect: () => mailStore.toggleChecked(mail.id),
    },
    {
      label: t(mail.unread ? "mailList.ctxMarkRead" : "mailList.ctxMarkUnread"),
      icon: "mail",
      onSelect: () => mailStore.markRead([mail.id], !mail.unread),
    },
    {
      label: t(mail.starred ? "mailList.ctxUnstar" : "mailList.ctxStar"),
      icon: "star",
      shortcut: "S",
      onSelect: () => mailStore.toggleStar([mail.id]),
    },
    {
      label: t("mailList.ctxSnooze"),
      icon: "clock",
      shortcut: "H",
      onSelect: () =>
        workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
    },
    {
      label: t("mailList.ctxManageLabels"),
      icon: "tag",
      shortcut: "L",
      onSelect: () =>
        workspace.setOverlay({
          type: "label-manage",
          mailIds: [mail.id],
          mode: "assign",
        }),
    },
    {
      label: t("mailList.ctxArchiveThread"),
      icon: "archive",
      shortcut: "E",
      onSelect: () => {
        mailStore.moveMails([mail.id], "archive");
        toastStore.pushToast({ tone: "info", title: t("toasts.mailArchived") });
      },
    },
    {
      label: t("mailList.ctxMoveToFolder"),
      icon: "folder",
      onSelect: () =>
        workspace.setOverlay({ type: "move-folder", mailIds: [mail.id] }),
    },
    { type: "divider" },
    {
      label: t("mailList.ctxViewRawHeaders"),
      icon: "code",
      onSelect: () =>
        workspace.setOverlay({ type: "mail-source", mailId: mail.id }),
    },
    {
      label: t(
        mail.folder === "trash"
          ? "mailList.ctxPermanentDelete"
          : "mailList.ctxMoveToTrash",
      ),
      icon: "trash",
      shortcut: "Del",
      danger: true,
      onSelect: () => {
        if (mail.folder === "trash") {
          workspace.setOverlay({
            type: "danger-confirm",
            kind: "permanent-delete",
            targetId: mail.id,
            targetLabel: mail.subject.trim()
              ? localizeText(mail.subject)
              : t("common.noSubject"),
          });
        } else {
          mailStore.moveMails([mail.id], "trash");
          toastStore.pushToast({
            tone: "info",
            title: t("toasts.movedToTrash"),
          });
        }
      },
    },
  ];

  return (
    <ActionMenu
      x={x}
      y={y}
      closing={closing}
      minWidth={220}
      items={items}
      onClose={onClose}
    />
  );
}
