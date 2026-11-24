import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { ProfileSwitcherCard } from "./ProfileSwitcherCard";
import { SidebarAccountsAndLabels } from "./SidebarAccountsAndLabels";
import {
  SidebarIconRail,
  countForFolder,
  getMainFolders,
} from "./SidebarIconRail";

export function Sidebar() {
  const { viewport, mailStore, composeStore } = useApp();
  const { t } = useI18n();
  const { mails, folderCounts, activeFolder, activeLabelId } = mailStore;

  if (viewport === "compact") {
    return <SidebarIconRail />;
  }

  const folders = getMainFolders(t);
  const outboxCount = countForFolder(mails, "outbox", folderCounts);
  const scheduledCount = countForFolder(mails, "scheduled", folderCounts);

  return (
    <aside
      className="panel-card sidebar-pane"
      aria-label={t("sidebar.ariaNav")}
    >
      <div className="sidebar-core-fixed">
        <button
          type="button"
          className="compose-cta"
          onClick={() => composeStore.openNewCompose()}
        >
          <Icon name="pen" size={15} />
          <span>{t("sidebar.compose")}</span>
        </button>

        <nav className="nav-section" aria-label={t("sidebar.ariaFolders")}>
          {folders.map((item) => {
            const isActive =
              !activeLabelId &&
              !mailStore.searchQuery &&
              activeFolder === item.id;
            const count = countForFolder(mails, item.id, folderCounts);
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

      <FadeScroll className="sidebar-scroll" label={t("sidebar.ariaScroll")}>
        {(outboxCount > 0 || scheduledCount > 0) && (
          <div className="nav-section">
            <button
              type="button"
              className={`nav-item ${!activeLabelId && activeFolder === "outbox" ? "active" : ""}`}
              onClick={() => mailStore.selectFolder("outbox")}
            >
              <span className="nav-item-main">
                <Icon name="upload" size={14} />
                <span className="nav-item-label">{t("sidebar.outbox")}</span>
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
                <span className="nav-item-label">{t("sidebar.scheduled")}</span>
              </span>
              <span className="nav-count">{scheduledCount}</span>
            </button>
          </div>
        )}

        <SidebarAccountsAndLabels />
      </FadeScroll>

      <div className="sidebar-footer">
        <div className="sidebar-footer-pair">
          <button
            type="button"
            className={`sidebar-mini-btn ${activeFolder === "spam" && !activeLabelId ? "active" : ""}`}
            onClick={() => mailStore.selectFolder("spam")}
          >
            <Icon name="spam" size={13} />
            <span className="truncate">{t("sidebar.spam")}</span>
          </button>
          <button
            type="button"
            className={`sidebar-mini-btn ${activeFolder === "trash" && !activeLabelId ? "active" : ""}`}
            onClick={() => mailStore.selectFolder("trash")}
          >
            <Icon name="trash" size={13} />
            <span className="truncate">{t("sidebar.trash")}</span>
          </button>
        </div>

        <ProfileSwitcherCard />
      </div>
    </aside>
  );
}
