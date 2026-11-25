import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { SidebarAccountSection } from "./SidebarAccountSection";
import { SidebarMuseSection } from "./SidebarMuseSection";
import { SidebarWorkBuddySection } from "./SidebarWorkBuddySection";

export function SidebarAccountsAndLabels({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, mailStore } = useApp();
  const { t, localizeText } = useI18n();
  const { labels, activeLabelId } = mailStore;

  return (
    <>
      <SidebarAccountSection onNavigate={onNavigate} />

      <div className="sidebar-divider" />

      <div className="nav-section">
        <div className="nav-section-head">
          <span>{t("sidebar.labels")}</span>
          <Tooltip label={t("sidebar.manageLabelsTip")} placement="right">
            <button
              type="button"
              className="nav-section-action"
              onClick={() => {
                onNavigate?.();
                workspace.setOverlay({ type: "label-manage", mode: "create" });
              }}
              aria-label={t("sidebar.manageLabelsAria")}
            >
              <Icon name="plus" size={13} />
            </button>
          </Tooltip>
        </div>
        {labels.map((lbl) => (
          <button
            key={lbl.id}
            type="button"
            className={`nav-item ${workspace.screen === "mail" && activeLabelId === lbl.id ? "active" : ""}`}
            onClick={() => {
              workspace.setScreen("mail");
              mailStore.selectLabel(lbl.id);
              onNavigate?.();
            }}
          >
            <span className="nav-item-main">
              <span className="label-dot" style={{ background: lbl.color }} />
              <span className="nav-item-label">{localizeText(lbl.name)}</span>
            </span>
          </button>
        ))}
      </div>

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
