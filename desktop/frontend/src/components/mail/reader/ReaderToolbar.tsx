import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon, type IconName } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { ReaderMoreMenu } from "./ReaderMoreMenu";

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
  const { viewport, workspace, mailStore, composeStore, aiStore, toastStore } =
    useApp();

  const isCompact = viewport === "compact";
  const isWide = viewport === "wide";

  const primaryActions: Array<{
    icon: IconName;
    label: string;
    visible: boolean;
    run: () => void;
  }> = [
    {
      icon: "reply",
      label: "回复",
      visible: true,
      run: () =>
        composeStore.openReplyCompose(
          mail,
          "reply",
          workspace.settings.lockReplyToOriginalAccount,
        ),
    },
    {
      icon: "forward",
      label: "转发",
      visible: !isCompact,
      run: () => composeStore.openReplyCompose(mail, "forward", false),
    },
    {
      icon: "archive",
      label: "归档",
      visible: true,
      run: () => {
        mailStore.moveMails([mail.id], "archive");
        toastStore.pushToast({ tone: "info", title: "邮件已归档" });
      },
    },
    {
      icon: "clock",
      label: "稍后",
      visible: isWide,
      run: () => workspace.setOverlay({ type: "snooze", mailIds: [mail.id] }),
    },
    {
      icon: "tag",
      label: "标签",
      visible: isWide,
      run: () =>
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
    <div className="reader-toolbar">
      <div className="reader-toolbar-group">
        {primaryActions
          .filter((act) => act.visible)
          .map((act) => (
            <button
              key={act.label}
              type="button"
              className="btn btn-sm btn-secondary reader-act-btn"
              onClick={act.run}
            >
              <Icon name={act.icon} size={13} /> {act.label}
            </button>
          ))}

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

        <ReaderMoreMenu mail={mail} />
      </div>

      <div className="reader-toolbar-group" style={{ flexShrink: 0 }}>
        {!isCompact && (
          <span className="reader-nav-count">
            {currentIndex + 1} / {Math.max(totalCount, 128)}
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
          className="btn btn-sm btn-ai reader-ai-toggle"
          onClick={() => {
            workspace.setLeftNavOpen(false);
            aiStore.setAiOpen((v) => !v);
          }}
        >
          <Icon name="sparkle" size={13} />
          <span>
            {isCompact ? "AI" : aiStore.aiOpen ? "收起 AI" : "展开 AI"}
          </span>
        </button>
      </div>
    </div>
  );
}
