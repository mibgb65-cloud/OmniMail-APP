import { isWailsDesktop } from "../../state/storageHelpers";
import { useApp } from "../../state/AppContext";
import type { FolderId, MailItem } from "../../types/mail";
import { Icon, type IconName } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export const MAIN_FOLDERS: Array<{
  id: FolderId;
  label: string;
  icon: IconName;
  shortcut?: string;
}> = [
  { id: "inbox", label: "统一收件箱", icon: "inbox", shortcut: "G I" },
  { id: "starred", label: "星标邮件", icon: "star", shortcut: "G S" },
  { id: "snoozed", label: "稍后处理", icon: "clock", shortcut: "G L" },
  { id: "sent", label: "已发送", icon: "send", shortcut: "G T" },
  { id: "drafts", label: "草稿箱", icon: "documentText", shortcut: "G D" },
  { id: "archive", label: "归档邮件", icon: "archive", shortcut: "G A" },
];

export function countForFolder(
  mails: MailItem[],
  folder: FolderId,
  folderCounts?: Record<string, number>,
): number {
  if (isWailsDesktop() && folderCounts) {
    return folderCounts[folder] ?? 0;
  }
  if (folder === "inbox") {
    return mails.filter((m) => m.folder === "inbox" && m.unread).length;
  }
  if (folder === "starred") {
    return mails.filter((m) => m.starred && m.folder !== "trash").length;
  }
  if (
    folder === "snoozed" ||
    folder === "drafts" ||
    folder === "outbox" ||
    folder === "scheduled"
  ) {
    return mails.filter((m) => m.folder === folder).length;
  }
  return 0;
}

export function SidebarIconRail() {
  const { workspace, mailStore, composeStore, aiStore } = useApp();
  const { mails, folderCounts, activeFolder, activeLabelId, searchQuery } =
    mailStore;

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
        <Tooltip label="展开导航与邮箱抽屉" placement="right">
          <button
            type="button"
            className="icon-rail-btn icon-rail-trigger"
            onClick={openLeftDrawer}
            aria-label="展开导航与邮箱抽屉"
          >
            <Icon name="menu" size={15} />
          </button>
        </Tooltip>

        <Tooltip label="写新邮件" shortcut="C" placement="right">
          <button
            type="button"
            className="icon-rail-compose"
            onClick={() => composeStore.openNewCompose()}
            aria-label="写邮件"
          >
            <Icon name="pen" size={15} />
          </button>
        </Tooltip>

        <div className="icon-rail-divider" />

        {MAIN_FOLDERS.map((item) => {
          const isActive =
            !activeLabelId && !searchQuery && activeFolder === item.id;
          const count = countForFolder(mails, item.id, folderCounts);
          return (
            <Tooltip
              key={item.id}
              label={item.label}
              badge={count}
              shortcut={item.shortcut}
              placement="right"
            >
              <button
                type="button"
                className={`icon-rail-btn ${isActive ? "active" : ""}`}
                onClick={() => mailStore.selectFolder(item.id)}
                aria-label={item.label}
              >
                <Icon name={item.icon} size={15} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="icon-rail-stack">
        {workspace.accounts.length === 0 ? (
          <Tooltip label="点击添加第一个邮箱" placement="right">
            <button
              type="button"
              className="icon-rail-accounts-badge is-empty"
              onClick={() => workspace.setOverlay({ type: "add-account" })}
              aria-label="点击添加第一个邮箱"
            >
              <Icon name="plus" size={10} /> 邮箱
            </button>
          </Tooltip>
        ) : (
          <Tooltip
            label="查看并切换已连接邮箱"
            badge={workspace.accounts.length}
            placement="right"
          >
            <button
              type="button"
              className="icon-rail-accounts-badge"
              onClick={openLeftDrawer}
              aria-label="查看并切换已连接邮箱"
            >
              {workspace.accounts.length} 邮
            </button>
          </Tooltip>
        )}
        <Tooltip
          label={`${workspace.activeProfile?.name || "个人工作空间"} · 切换本地空间`}
          placement="right"
        >
          <button
            type="button"
            className="profile-avatar icon-rail-avatar"
            onClick={() =>
              workspace.setOverlay({ type: "profile-manage", mode: "switch" })
            }
            aria-label="切换本地空间"
          >
            {workspace.activeProfile?.badge || "个"}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
