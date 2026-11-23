import { useRef, useState } from "react";
import { useApp } from "../../../state/AppContext";
import { useValuePresence } from "../../../state/usePresence";
import type { MailItem } from "../../../types/mail";
import { ActionMenu, type ActionMenuEntry } from "../../common/ActionMenu";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";

export function ReaderMoreMenu({ mail }: { mail: MailItem }) {
  const { viewport, workspace, mailStore, composeStore, toastStore } = useApp();
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const { rendered: activePos, closing } = useValuePresence(menuPos, 100);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const foldedItems: ActionMenuEntry[] = [
    ...(viewport === "compact"
      ? [
          {
            label: "转发此封邮件",
            icon: "forward" as const,
            shortcut: "F",
            onSelect: () =>
              composeStore.openReplyCompose(mail, "forward", false),
          },
        ]
      : []),
    ...(viewport !== "wide"
      ? [
          {
            label: "稍后处理提醒…",
            icon: "clock" as const,
            shortcut: "H",
            onSelect: () =>
              workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
          },
          {
            label: "管理邮件标签…",
            icon: "tag" as const,
            shortcut: "L",
            onSelect: () =>
              workspace.setOverlay({
                type: "label-manage",
                mailIds: [mail.id],
                mode: "assign",
              }),
          },
        ]
      : []),
  ];

  const items: ActionMenuEntry[] = [
    ...foldedItems,
    ...(foldedItems.length > 0 ? [{ type: "divider" as const }] : []),
    {
      label: "移动到文件夹…",
      icon: "folder",
      onSelect: () =>
        workspace.setOverlay({ type: "move-folder", mailIds: [mail.id] }),
    },
    {
      label: "查看原始邮件头与源码",
      icon: "code",
      onSelect: () =>
        workspace.setOverlay({ type: "mail-source", mailId: mail.id }),
    },
    {
      label: "打印与导出邮件 (.pdf / .eml)",
      icon: "printer",
      onSelect: () =>
        workspace.setOverlay({ type: "print-export", mailId: mail.id }),
    },
    {
      label: "附件传输队列与失败恢复",
      icon: "upload",
      onSelect: () =>
        workspace.setOverlay({ type: "attachment-transfer", mode: "transfer" }),
    },
    { type: "divider" },
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
    <>
      <Tooltip label="更多邮件操作">
        <button
          ref={btnRef}
          type="button"
          className="icon-btn icon-btn-bordered reader-icon-btn"
          aria-label="更多邮件操作"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (menuPos) {
              setMenuPos(null);
              return;
            }
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) setMenuPos({ left: rect.left, top: rect.bottom + 6 });
          }}
        >
          <Icon name="more" size={14} />
        </button>
      </Tooltip>

      {activePos && (
        <ActionMenu
          x={activePos.left}
          y={activePos.top}
          closing={closing}
          minWidth={232}
          items={items}
          onClose={() => setMenuPos(null)}
        />
      )}
    </>
  );
}
