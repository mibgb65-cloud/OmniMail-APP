import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { ProfileSwitcherCard } from "./ProfileSwitcherCard";
import { SidebarAccountsAndLabels } from "./SidebarAccountsAndLabels";
import { countForFolder, getMainFolders } from "./SidebarIconRail";

export function LeftNavDrawer({ closing = false }: { closing?: boolean }) {
  const { workspace, mailStore, composeStore } = useApp();
  const { t } = useI18n();
  const { mails, folderCounts, activeFolder, activeLabelId, searchQuery } =
    mailStore;
  const folders = getMainFolders(t);

  const close = () => workspace.setLeftNavOpen(false);

  return (
    <div
      className="workspace-drawer-layer"
      data-closing={closing ? "true" : "false"}
      role="dialog"
      aria-label={t("sidebar.drawerAria")}
    >
      <div
        className="drawer-scrim"
        onClick={close}
        aria-label={t("sidebar.drawerScrimAria")}
      />
      <aside className="panel-card left-nav-drawer">
        <div className="sidebar-core-fixed">
          <div className="drawer-head-row">
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <strong className="drawer-head-title truncate">
                {t("sidebar.drawerTitle")}
              </strong>
              <span className="drawer-mode-chip">
                {t("sidebar.drawerModeChip")}
              </span>
            </div>
            <Tooltip label={t("sidebar.closeDrawerTip")} shortcut="Esc">
              <button
                type="button"
                className="icon-btn icon-btn-bordered drawer-close-btn"
                onClick={close}
                aria-label={t("sidebar.closeDrawerTip")}
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
            <span>{t("sidebar.compose")}</span>
          </button>

          <nav
            className="nav-section"
            aria-label={t("sidebar.ariaCoreFolders")}
          >
            {folders.map((item) => {
              const isActive =
                workspace.screen === "mail" &&
                !activeLabelId &&
                !searchQuery &&
                activeFolder === item.id;
              const count = countForFolder(mails, item.id, folderCounts);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item nav-item-drawer ${isActive ? "active" : ""}`}
                  onClick={() => {
                    workspace.setScreen("mail");
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

        <FadeScroll className="sidebar-scroll" label={t("sidebar.ariaScroll")}>
          <SidebarAccountsAndLabels onNavigate={close} />
        </FadeScroll>

        <div className="sidebar-footer">
          <div className="sidebar-footer-pair">
            <button
              type="button"
              className={`sidebar-mini-btn ${workspace.screen === "mail" && activeFolder === "spam" && !activeLabelId ? "active" : ""}`}
              onClick={() => {
                workspace.setScreen("mail");
                mailStore.selectFolder("spam");
                close();
              }}
            >
              <Icon name="spam" size={13} />
              <span>{t("sidebar.spam")}</span>
            </button>
            <button
              type="button"
              className={`sidebar-mini-btn ${workspace.screen === "mail" && activeFolder === "trash" && !activeLabelId ? "active" : ""}`}
              onClick={() => {
                workspace.setScreen("mail");
                mailStore.selectFolder("trash");
                close();
              }}
            >
              <Icon name="trash" size={13} />
              <span>{t("sidebar.trash")}</span>
            </button>
          </div>

          <ProfileSwitcherCard compact />
        </div>
      </aside>
    </div>
  );
}
