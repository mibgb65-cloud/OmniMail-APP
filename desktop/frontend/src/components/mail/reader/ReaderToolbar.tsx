import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import type { ActionMenuEntry } from "../../common/ActionMenu";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { ReaderTranslateButton } from "../translation/ReaderTranslateButton";
import { ReaderMoreMenu } from "./ReaderMoreMenu";
import {
  readerToolbarSlotStyles,
  type ReaderActionId,
} from "./readerToolbarLayout";
import { useReaderToolbarLayout } from "./useReaderToolbarLayout";

interface ReaderToolbarProps {
  mail: MailItem;
  currentIndex: number;
  totalCount: number;
  onNavigate: (delta: -1 | 1) => void;
}

export function ReaderToolbar({
  mail,
  currentIndex,
  totalCount,
  onNavigate,
}: ReaderToolbarProps) {
  const { workspace, mailStore, composeStore, aiStore, toastStore } = useApp();
  const { ref, layout } = useReaderToolbarLayout();
  const aiLabel = aiStore.aiOpen ? "收起 AI" : "展开 AI";
  const actions: Array<
    Extract<ActionMenuEntry, { label: string }> & { id: ReaderActionId }
  > = [
    {
      id: "reply",
      icon: "reply",
      label: "回复",
      onSelect: () =>
        composeStore.openReplyCompose(
          mail,
          "reply",
          workspace.settings.lockReplyToOriginalAccount,
        ),
    },
    {
      id: "forward",
      icon: "forward",
      label: "转发",
      shortcut: "F",
      onSelect: () => composeStore.openReplyCompose(mail, "forward", false),
    },
    {
      id: "archive",
      icon: "archive",
      label: "归档",
      onSelect: () => {
        mailStore.moveMails([mail.id], "archive");
        toastStore.pushToast({ tone: "info", title: "邮件已归档" });
      },
    },
    {
      id: "snooze",
      icon: "clock",
      label: "稍后",
      shortcut: "H",
      onSelect: () =>
        workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
    },
    {
      id: "label",
      icon: "tag",
      label: "标签",
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
      workspace.setOverlay({
        type: "danger-confirm",
        kind: "permanent-delete",
        targetId: mail.id,
        targetLabel: mail.subject,
      });
      return;
    }
    mailStore.moveMails([mail.id], "trash");
    toastStore.pushToast({ tone: "info", title: "已移入回收站" });
  };

  return (
    <div
      ref={ref}
      className="reader-toolbar"
      style={readerToolbarSlotStyles}
      data-tool-density={layout.density}
      data-ai-label={layout.aiLabel}
    >
      <div className="reader-toolbar-group">
        {actions
          .filter((action) => layout.actions.includes(action.id))
          .map((act) => (
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
          <Tooltip
            label={mail.folder === "trash" ? "永久删除" : "移入回收站"}
            shortcut="Del"
          >
            <button
              type="button"
              className="icon-btn icon-btn-bordered reader-icon-btn"
              onClick={handleDelete}
              aria-label="删除邮件"
            >
              <Icon name="trash" size={13} />
            </button>
          </Tooltip>
        )}
        <ReaderMoreMenu
          mail={mail}
          onDelete={handleDelete}
          foldedItems={actions.filter(
            (action) => !layout.actions.includes(action.id),
          )}
        />
      </div>

      <div className="reader-toolbar-group reader-toolbar-nav">
        {layout.showCount && totalCount > 0 && (
          <span
            className="reader-nav-count"
            title={`${currentIndex + 1} / ${totalCount}`}
          >
            {currentIndex + 1} / {totalCount}
          </span>
        )}
        <Tooltip label="上一封邮件" shortcut="K">
          <button
            type="button"
            className="icon-btn icon-btn-bordered reader-icon-btn"
            disabled={currentIndex <= 0}
            onClick={() => onNavigate(-1)}
            aria-label="上一封邮件"
          >
            <Icon name="chevronLeft" size={13} />
          </button>
        </Tooltip>
        <Tooltip label="下一封邮件" shortcut="J">
          <button
            type="button"
            className="icon-btn icon-btn-bordered reader-icon-btn"
            disabled={currentIndex >= totalCount - 1}
            onClick={() => onNavigate(1)}
            aria-label="下一封邮件"
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
