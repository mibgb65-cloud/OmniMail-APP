import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { ProfileSwitcherCard } from "./ProfileSwitcherCard";
import { SidebarAccountsAndLabels } from "./SidebarAccountsAndLabels";
import { MAIN_FOLDERS, countForFolder } from "./SidebarIconRail";

export function LeftNavDrawer({ closing = false }: { closing?: boolean }) {
  const { workspace, mailStore, composeStore } = useApp();
  const { mails, folderCounts, activeFolder, activeLabelId, searchQuery } =
    mailStore;

  const close = () => workspace.setLeftNavOpen(false);

  return (
    <div
      className="workspace-drawer-layer"
      data-closing={closing ? "true" : "false"}
      role="dialog"
      aria-label="导航抽屉"
    >
      <div
        className="drawer-scrim"
        onClick={close}
        aria-label="点击遮罩收起导航抽屉"
      />
      <aside className="panel-card left-nav-drawer">
        <div className="sidebar-core-fixed">
          <div className="drawer-head-row">
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <strong className="drawer-head-title truncate">导航与邮箱</strong>
              <span className="drawer-mode-chip">抽屉模式</span>
            </div>
            <Tooltip label="收起导航抽屉" shortcut="Esc">
              <button
                type="button"
                className="icon-btn icon-btn-bordered drawer-close-btn"
                onClick={close}
                aria-label="收起导航抽屉"
              >
                <Icon name="x" size={13} />
              </button>
            </Tooltip>
          </div>

          <button
            type="button"
            className="compose-cta compose-cta-drawer"
            onClick={() => {
              close();
              composeStore.openNewCompose();
            }}
          >
            <Icon name="pen" size={14} />
            <span>写邮件</span>
          </button>

          <nav className="nav-section" aria-label="邮件核心文件夹">
            {MAIN_FOLDERS.map((item) => {
              const isActive =
                !activeLabelId && !searchQuery && activeFolder === item.id;
              const count = countForFolder(mails, item.id, folderCounts);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item nav-item-drawer ${isActive ? "active" : ""}`}
                  onClick={() => {
                    mailStore.selectFolder(item.id);
                    close();
                  }}
                >
                  <span className="nav-item-main">
                    <Icon name={item.icon} size={13} />
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
          <SidebarAccountsAndLabels onNavigate={close} compactSingleLine />
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-pair">
            <button
              type="button"
              className={`sidebar-mini-btn ${activeFolder === "spam" && !activeLabelId ? "active" : ""}`}
              onClick={() => {
                mailStore.selectFolder("spam");
                close();
              }}
            >
              <Icon name="spam" size={13} />
              <span>垃圾邮件</span>
            </button>
            <button
              type="button"
              className={`sidebar-mini-btn ${activeFolder === "trash" && !activeLabelId ? "active" : ""}`}
              onClick={() => {
                mailStore.selectFolder("trash");
                close();
              }}
            >
              <Icon name="trash" size={13} />
              <span>回收站</span>
            </button>
          </div>

          <ProfileSwitcherCard compact />
        </div>
      </aside>
    </div>
  );
}
