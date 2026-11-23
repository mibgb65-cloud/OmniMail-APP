import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import type { MailItem } from "../../types/mail";
import { ActionMenu, type ActionMenuEntry } from "../common/ActionMenu";

interface MailContextMenuProps {
  state: { mail: MailItem; x: number; y: number } | null;
  onClose: () => void;
}

export function MailContextMenu({ state, onClose }: MailContextMenuProps) {
  const { workspace, mailStore, composeStore, toastStore } = useApp();
  const { rendered, closing } = useValuePresence(state, 100);
  if (!rendered) return null;
  const { mail, x, y } = rendered;

  const items: ActionMenuEntry[] = [
    {
      label: "回复发件人",
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
      label: "转发邮件",
      icon: "forward",
      shortcut: "F",
      onSelect: () => composeStore.openReplyCompose(mail, "forward", false),
    },
    { type: "divider" },
    {
      label: mailStore.checkedIds.includes(mail.id)
        ? "取消选中"
        : "批量多选邮件",
      icon: "check",
      onSelect: () => mailStore.toggleChecked(mail.id),
    },
    {
      label: mail.unread ? "标为已读" : "标为未读",
      icon: "mail",
      onSelect: () => mailStore.markRead([mail.id], !mail.unread),
    },
    {
      label: mail.starred ? "取消星标" : "标记为星标",
      icon: "star",
      shortcut: "S",
      onSelect: () => mailStore.toggleStar([mail.id]),
    },
    {
      label: "稍后处理…",
      icon: "clock",
      shortcut: "H",
      onSelect: () =>
        workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
    },
    {
      label: "管理标签…",
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
      label: "归档会话",
      icon: "archive",
      shortcut: "E",
      onSelect: () => {
        mailStore.moveMails([mail.id], "archive");
        toastStore.pushToast({ tone: "info", title: "邮件已归档" });
      },
    },
    {
      label: "移动到文件夹…",
      icon: "folder",
      onSelect: () =>
        workspace.setOverlay({ type: "move-folder", mailIds: [mail.id] }),
    },
    { type: "divider" },
    {
      label: "查看原始邮件头",
      icon: "code",
      onSelect: () =>
        workspace.setOverlay({ type: "mail-source", mailId: mail.id }),
    },
    {
      label: mail.folder === "trash" ? "永久删除邮件" : "移至回收站",
      icon: "trash",
      shortcut: "Del",
      danger: true,
      onSelect: () => {
        if (mail.folder === "trash") {
          workspace.setOverlay({
            type: "danger-confirm",
            kind: "permanent-delete",
            targetId: mail.id,
            targetLabel: mail.subject,
          });
        } else {
          mailStore.moveMails([mail.id], "trash");
          toastStore.pushToast({ tone: "info", title: "已移入回收站" });
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
