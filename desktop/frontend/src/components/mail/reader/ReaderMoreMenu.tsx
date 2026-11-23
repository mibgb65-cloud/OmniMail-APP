import { useRef, useState } from "react";
import { useApp } from "../../../state/AppContext";
import { useValuePresence } from "../../../state/usePresence";
import type { MailItem } from "../../../types/mail";
import { ActionMenu, type ActionMenuEntry } from "../../common/ActionMenu";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";

export function ReaderMoreMenu({
  mail,
  onDelete,
  foldedItems,
}: {
  mail: MailItem;
  onDelete: () => void;
  foldedItems: ActionMenuEntry[];
}) {
  const { workspace } = useApp();
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const { rendered: activePos, closing } = useValuePresence(menuPos, 100);
  const btnRef = useRef<HTMLButtonElement | null>(null);

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
      onSelect: onDelete,
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
          aria-haspopup="menu"
          aria-expanded={menuPos !== null}
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
