import { useEffect } from "react";
import { useApp } from "../../state/AppContext";
import type { MailItem } from "../../types/mail";
import { Icon } from "../common/Icon";

interface MailContextMenuProps {
  mail: MailItem;
  x: number;
  y: number;
  onClose: () => void;
}

export function MailContextMenu({ mail, x, y, onClose }: MailContextMenuProps) {
  const { workspace, mailStore, composeStore, toastStore } = useApp();

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 230);
  const top = Math.min(y, window.innerHeight - 360);

  return (
    <div
      className="context-menu"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          composeStore.openReplyCompose(
            mail,
            "reply",
            workspace.settings.lockReplyToOriginalAccount,
          );
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="reply" size={14} /> 回复发件人
        </span>
        <span className="kbd">R</span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          composeStore.openReplyCompose(mail, "forward", false);
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="forward" size={14} /> 转发邮件
        </span>
        <span className="kbd">F</span>
      </button>

      <div className="context-menu-divider" />

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          mailStore.toggleChecked(mail.id);
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="check" size={14} />{" "}
          {mailStore.checkedIds.includes(mail.id) ? "取消选中" : "批量多选邮件"}
        </span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          mailStore.markRead([mail.id], !mail.unread);
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="mail" size={14} /> {mail.unread ? "标为已读" : "标为未读"}
        </span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          mailStore.toggleStar([mail.id]);
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="star" size={14} />{" "}
          {mail.starred ? "取消星标" : "添加星标"}
        </span>
        <span className="kbd">S</span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          workspace.setOverlay({ type: "snooze", mailIds: [mail.id] });
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="clock" size={14} /> 稍后提醒
        </span>
        <span className="kbd">H</span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          workspace.setOverlay({
            type: "label-manage",
            mailIds: [mail.id],
            mode: "assign",
          });
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="tag" size={14} /> 管理标签
        </span>
        <span className="kbd">L</span>
      </button>

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          workspace.setOverlay({ type: "move-folder", mailIds: [mail.id] });
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="folder" size={14} /> 移动到文件夹…
        </span>
      </button>

      <div className="context-menu-divider" />

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          workspace.setOverlay({ type: "mail-source", mailId: mail.id });
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="code" size={14} /> 查看原始邮件头
        </span>
      </button>

      <button
        type="button"
        className="context-menu-item danger"
        onClick={() => {
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
          onClose();
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="trash" size={14} />
          {mail.folder === "trash" ? "永久删除邮件" : "移入回收站"}
        </span>
      </button>
    </div>
  );
}
