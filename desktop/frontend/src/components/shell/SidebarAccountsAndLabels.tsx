import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { SidebarAccountSection } from "./SidebarAccountSection";
import { SidebarLabelSection } from "./SidebarLabelSection";
import { SidebarMuseSection } from "./SidebarMuseSection";
import { SidebarWorkBuddySection } from "./SidebarWorkBuddySection";

export function SidebarAccountsAndLabels({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace } = useApp();
  const { t } = useI18n();

  return (
    <>
      <SidebarAccountSection onNavigate={onNavigate} />

      <div className="sidebar-divider" />

      <SidebarLabelSection onNavigate={onNavigate} />

      <div className="nav-section">
        <button
          type="button"
          className="nav-item"
          onClick={() => {
            onNavigate?.();
            workspace.setScreen("contacts");
          }}
        >
          <span className="nav-item-main">
            <Icon name="users" size={14} />
            <span className="nav-item-label">
              {t("sidebar.contactsAndVip")}
            </span>
          </span>
          <span className="nav-count">{workspace.contacts.length}</span>
        </button>
      </div>

      <SidebarWorkBuddySection onNavigate={onNavigate} />
      <SidebarMuseSection onNavigate={onNavigate} />
    </>
  );
}
