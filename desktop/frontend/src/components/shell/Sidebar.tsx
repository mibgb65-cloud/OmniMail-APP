import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { SidebarAccountsAndLabels } from "./SidebarAccountsAndLabels";
import {
  MAIN_FOLDERS,
  SidebarIconRail,
  countForFolder,
} from "./SidebarIconRail";

export function Sidebar() {
  const { viewport, workspace, mailStore, composeStore } = useApp();
  const { mails, activeFolder, activeLabelId } = mailStore;

  if (viewport === "compact") {
    return <SidebarIconRail />;
  }

  const outboxCount = countForFolder(mails, "outbox");
  const scheduledCount = countForFolder(mails, "scheduled");

  return (
    <aside className="panel-card sidebar-pane" aria-label="邮箱与文件夹导航">
      <div className="sidebar-core-fixed">
        <button
          type="button"
          className="compose-cta"
          onClick={() => composeStore.openNewCompose()}
        >
          <Icon name="pen" size={15} />
          <span>写邮件</span>
        </button>

        <nav className="nav-section" aria-label="邮件文件夹">
          {MAIN_FOLDERS.map((item) => {
            const isActive =
              !activeLabelId &&
              !mailStore.searchQuery &&
              activeFolder === item.id;
            const count = countForFolder(mails, item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => mailStore.selectFolder(item.id)}
              >
                <span className="nav-item-main">
                  <Icon name={item.icon} size={14} />
                  <span className="nav-item-label">{item.label}</span>
                </span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-divider" />
      </div>

      <div className="sidebar-scroll">
        {(outboxCount > 0 || scheduledCount > 0) && (
          <div className="nav-section">
            <button
              type="button"
              className={`nav-item ${!activeLabelId && activeFolder === "outbox" ? "active" : ""}`}
              onClick={() => mailStore.selectFolder("outbox")}
            >
              <span className="nav-item-main">
                <Icon name="upload" size={14} />
                <span className="nav-item-label">待发送队列</span>
              </span>
              <span
                className="pill pill-danger"
                style={{ height: 18, padding: "0 6px", fontSize: 11 }}
              >
                {outboxCount}
              </span>
            </button>
            <button
              type="button"
              className={`nav-item ${!activeLabelId && activeFolder === "scheduled" ? "active" : ""}`}
              onClick={() => mailStore.selectFolder("scheduled")}
            >
              <span className="nav-item-main">
                <Icon name="calendar" size={14} />
                <span className="nav-item-label">定时邮件</span>
              </span>
              <span className="nav-count">{scheduledCount}</span>
            </button>
          </div>
        )}

        <SidebarAccountsAndLabels />
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-pair">
          <button
            type="button"
            className={`sidebar-mini-btn ${activeFolder === "spam" && !activeLabelId ? "active" : ""}`}
            onClick={() => mailStore.selectFolder("spam")}
          >
            <Icon name="spam" size={13} />
            <span className="truncate">垃圾邮件</span>
          </button>
          <button
            type="button"
            className={`sidebar-mini-btn ${activeFolder === "trash" && !activeLabelId ? "active" : ""}`}
            onClick={() => mailStore.selectFolder("trash")}
          >
            <Icon name="trash" size={13} />
            <span className="truncate">回收站</span>
          </button>
        </div>

        <div className="profile-card">
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <div className="profile-avatar">陆</div>
            <div className="account-row-meta">
              <span className="profile-name truncate">陆星河</span>
              {viewport !== "laptop" && (
                <span className="profile-sub truncate">个人工作空间</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 28, height: 28, flexShrink: 0 }}
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "accounts" })
            }
            aria-label="管理工作空间与账户"
          >
            <Icon name="settings" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
