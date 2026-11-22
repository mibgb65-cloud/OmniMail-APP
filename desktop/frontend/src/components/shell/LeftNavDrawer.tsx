import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { SidebarAccountsAndLabels } from "./SidebarAccountsAndLabels";
import { MAIN_FOLDERS, countForFolder } from "./SidebarIconRail";

export function LeftNavDrawer() {
  const { workspace, mailStore, composeStore } = useApp();
  const { mails, activeFolder, activeLabelId, searchQuery } = mailStore;

  const close = () => workspace.setLeftNavOpen(false);

  return (
    <div className="workspace-drawer-layer" role="dialog" aria-label="导航抽屉">
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
            <button
              type="button"
              className="icon-btn icon-btn-bordered drawer-close-btn"
              onClick={close}
              title="收起导航抽屉 (Esc)"
              aria-label="收起导航抽屉"
            >
              <Icon name="x" size={13} />
            </button>
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
              const count = countForFolder(mails, item.id);
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

          <div className="profile-card profile-card-drawer">
            <div className="row" style={{ gap: 7, minWidth: 0 }}>
              <div className="profile-avatar" style={{ width: 24, height: 24 }}>
                陆
              </div>
              <span
                className="truncate"
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                陆星河 · 个人空间
              </span>
            </div>
            <span className="drawer-esc-hint">Esc</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
