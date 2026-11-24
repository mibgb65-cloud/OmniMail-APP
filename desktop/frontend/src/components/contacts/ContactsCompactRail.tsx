import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { IconName } from "../common/Icon";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import type { ContactNavFilter } from "./ContactsSidebar";

export function ContactsCompactRail({
  navItems,
  navFilter,
  groupFilter,
  onSelectNav,
  onSelectGroup,
}: {
  navItems: Array<readonly [ContactNavFilter, string, number, IconName]>;
  navFilter: ContactNavFilter;
  groupFilter: string | null;
  onSelectNav: (nav: ContactNavFilter) => void;
  onSelectGroup: (group: string | null) => void;
}) {
  const { workspace } = useApp();
  const { t, localizeText } = useI18n();

  const ownerName =
    workspace.accounts[0]?.senderName ||
    workspace.accounts[0]?.name ||
    localizeText(
      workspace.activeProfile?.name || t("common.personalWorkspace"),
    );
  const ownerBadge =
    Array.from(ownerName.trim())[0] || t("common.personalBadge");
  const manageAccountsLabel = t("contacts.compactManageAccountsTip", {
    name: ownerName,
  });

  return (
    <aside
      className="panel-card icon-rail-pane"
      aria-label={t("contacts.compactRailAria")}
    >
      <div className="icon-rail-stack">
        <Tooltip
          label={t("contacts.backToInbox")}
          shortcut="G I"
          placement="right"
        >
          <button
            type="button"
            className="icon-rail-btn icon-rail-trigger"
            onClick={() => workspace.setScreen("mail")}
            aria-label={t("contacts.backToInbox")}
          >
            <Icon name="arrowLeft" size={15} />
          </button>
        </Tooltip>

        <Tooltip label={t("contacts.newContact")} placement="right">
          <button
            type="button"
            className="icon-rail-compose"
            onClick={() => workspace.setOverlay({ type: "contact-edit" })}
            aria-label={t("contacts.newContact")}
          >
            <Icon name="plus" size={15} />
          </button>
        </Tooltip>

        <div className="icon-rail-divider" />

        {navItems.map(([id, label, count, icon]) => (
          <Tooltip key={id} label={label} badge={count} placement="right">
            <button
              type="button"
              className={`icon-rail-btn ${navFilter === id && !groupFilter ? "active" : ""}`}
              onClick={() => {
                onSelectNav(id);
                onSelectGroup(null);
              }}
              aria-label={label}
            >
              <Icon name={icon} size={15} />
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="icon-rail-stack">
        <Tooltip label={manageAccountsLabel} placement="right">
          <button
            type="button"
            className="profile-avatar icon-rail-avatar"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "accounts" })
            }
            aria-label={manageAccountsLabel}
          >
            {ownerBadge}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
