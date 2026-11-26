import { useRef, useState, type RefObject } from "react";
import { useI18n } from "../../../i18n";
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
  triggerRef,
}: {
  mail: MailItem;
  onDelete: () => void;
  foldedItems: ActionMenuEntry[];
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useI18n();
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
      label: t("mailList.ctxMoveToFolder"),
      icon: "folder",
      onSelect: () =>
        workspace.setOverlay({ type: "move-folder", mailIds: [mail.id] }),
    },
    {
      label: t("reader.moreViewSource"),
      icon: "code",
      onSelect: () =>
        workspace.setOverlay({ type: "mail-source", mailId: mail.id }),
    },
    {
      label: t("reader.morePrintExport"),
      icon: "printer",
      onSelect: () =>
        workspace.setOverlay({ type: "print-export", mailId: mail.id }),
    },
    {
      label: t("reader.moreAttachmentQueue"),
      icon: "upload",
      onSelect: () =>
        workspace.setOverlay({ type: "attachment-transfer", mode: "transfer" }),
    },
    { type: "divider" },
    {
      label: t(
        mail.folder === "trash"
          ? "mailList.ctxPermanentDelete"
          : "mailList.ctxMoveToTrash",
      ),
      icon: "trash",
      shortcut: "Del",
      danger: true,
      onSelect: onDelete,
    },
  ];

  return (
    <>
      <Tooltip label={t("reader.moreActionsTip")}>
        <button
          ref={(node) => {
            btnRef.current = node;
            if (triggerRef) triggerRef.current = node;
          }}
          type="button"
          className="icon-btn icon-btn-bordered reader-icon-btn"
          aria-label={t("reader.moreActionsTip")}
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
