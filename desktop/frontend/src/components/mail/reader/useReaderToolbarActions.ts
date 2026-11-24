import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import type { ActionMenuEntry } from "../../common/ActionMenu";
import type { ReaderActionId } from "./readerToolbarLayout";

export function useReaderToolbarActions(mail: MailItem) {
  const { t, localizeText } = useI18n();
  const { workspace, mailStore, composeStore, toastStore } = useApp();
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

  return { actions, handleDelete };
}
