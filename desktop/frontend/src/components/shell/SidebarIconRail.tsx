import { useApp } from "../../state/AppContext";
import type { FolderId, MailItem } from "../../types/mail";
import { Icon, type IconName } from "../common/Icon";

export const MAIN_FOLDERS: Array<{
  id: FolderId;
  label: string;
  icon: IconName;
}> = [
  { id: "inbox", label: "统一收件箱", icon: "inbox" },
  { id: "starred", label: "星标邮件", icon: "star" },
  { id: "snoozed", label: "稍后处理", icon: "clock" },
  { id: "sent", label: "已发送", icon: "send" },
  { id: "drafts", label: "草稿箱", icon: "file" },
  { id: "archive", label: "归档邮件", icon: "archive" },
];

export function countForFolder(mails: MailItem[], folder: FolderId): number {
  if (folder === "inbox") return 28;
  if (folder === "starred")
    return mails.filter((m) => m.starred && m.folder !== "trash").length + 3;
  if (folder === "snoozed")
    return mails.filter((m) => m.folder === "snoozed").length + 2;
  if (folder === "drafts")
    return mails.filter((m) => m.folder === "drafts").length + 1;
  if (folder === "outbox")
    return mails.filter((m) => m.folder === "outbox").length;
  if (folder === "scheduled")
    return mails.filter((m) => m.folder === "scheduled").length;
  return 0;
}

export function SidebarIconRail() {
  const { workspace, mailStore, composeStore, aiStore } = useApp();
  const { activeFolder, activeLabelId, searchQuery } = mailStore;

  const openLeftDrawer = () => {
    aiStore.setAiOpen(false);
    workspace.setLeftNavOpen(true);
  };

  return (
    <aside
      className="panel-card icon-rail-pane"
      aria-label="紧凑模式图标导航栏"
    >
      <div className="icon-rail-stack">
        <button
          type="button"
          className="icon-rail-btn icon-rail-trigger"
          onClick={openLeftDrawer}
          title="展开导航与邮箱抽屉"
          aria-label="展开导航与邮箱抽屉"
        >
          <Icon name="menu" size={15} />
        </button>

        <button
          type="button"
          className="icon-rail-compose"
          onClick={() => composeStore.openNewCompose()}
          title="写邮件 (Ctrl+N)"
          aria-label="写邮件"
        >
          <Icon name="pen" size={15} />
        </button>

        <div className="icon-rail-divider" />

        {MAIN_FOLDERS.map((item) => {
          const isActive =
            !activeLabelId && !searchQuery && activeFolder === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`icon-rail-btn ${isActive ? "active" : ""}`}
              onClick={() => mailStore.selectFolder(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              <Icon name={item.icon} size={15} />
            </button>
          );
        })}
      </div>

      <div className="icon-rail-stack">
        <button
          type="button"
          className="icon-rail-accounts-badge"
          onClick={openLeftDrawer}
          title="查看并切换已连接邮箱"
          aria-label="查看并切换已连接邮箱"
        >
          {workspace.accounts.length} 邮
        </button>
        <button
          type="button"
          className="profile-avatar icon-rail-avatar"
          onClick={() =>
            workspace.setOverlay({ type: "settings", tab: "accounts" })
          }
          title="陆星河 · 管理工作空间与账户"
          aria-label="管理工作空间与账户"
        >
          陆
        </button>
      </div>
    </aside>
  );
}
