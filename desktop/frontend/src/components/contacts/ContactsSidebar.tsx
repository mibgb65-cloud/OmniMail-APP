import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon, type IconName } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { ContactsCompactRail } from "./ContactsCompactRail";

export type ContactNavFilter =
  "all" | "vip" | "frequent" | "recent" | "blacklist";

export const CONTACT_GROUPS = [
  "核心项目组",
  "设计评审",
  "财务与法务",
  "外部供应商",
];

export function ContactsSidebar({
  navFilter,
  groupFilter,
  accountFilter,
  onSelectNav,
  onSelectGroup,
  onSelectAccount,
}: {
  navFilter: ContactNavFilter;
  groupFilter: string | null;
  accountFilter: string | null;
  onSelectNav: (nav: ContactNavFilter) => void;
  onSelectGroup: (group: string | null) => void;
  onSelectAccount: (accId: string | null) => void;
}) {
  const { viewport, workspace } = useApp();
  const { t, localizeGroup, localizeText } = useI18n();

  const navItems: Array<readonly [ContactNavFilter, string, number, IconName]> =
    [
      ["all", t("contacts.navAll"), workspace.contacts.length, "users"],
      [
        "vip",
        t("contacts.navVip"),
        workspace.contacts.filter((c) => c.vip).length,
        "star",
      ],
      [
        "frequent",
        t("contacts.navFrequent"),
        workspace.contacts.filter((c) => c.mailCount >= 20).length,
        "zap",
      ],
      ["recent", t("contacts.navRecent"), workspace.contacts.length, "clock"],
      [
        "blacklist",
        t("contacts.navBlacklist"),
        workspace.blacklist.length,
        "ban",
      ],
    ];

  if (viewport === "compact") {
    return (
      <ContactsCompactRail
        navItems={navItems}
        navFilter={navFilter}
        groupFilter={groupFilter}
        onSelectNav={onSelectNav}
        onSelectGroup={onSelectGroup}
      />
    );
  }

  return (
    <aside
      className="panel-card sidebar-pane"
      aria-label={t("contacts.sidebarAria")}
    >
      <div className="sidebar-core-fixed">
        <button
          type="button"
          className="compose-cta"
          onClick={() => workspace.setOverlay({ type: "contact-edit" })}
        >
          <Icon name="plus" size={15} />
          <span>{t("contacts.newContact")}</span>
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() => workspace.setScreen("mail")}
        >
          <span className="nav-item-main">
            <Icon name="arrowLeft" size={14} />
            <span className="nav-item-label">{t("contacts.backToInbox")}</span>
          </span>
        </button>

        <div className="sidebar-section-head">
          <span>{t("contacts.viewsSection")}</span>
        </div>
        <div className="nav-section">
          {navItems.map(([id, label, count, icon]) => (
            <button
              key={id}
              type="button"
              className={`nav-item${navFilter === id && !groupFilter ? " active" : ""}`}
              onClick={() => {
                onSelectNav(id);
                onSelectGroup(null);
              }}
            >
              <span className="nav-item-main">
                <Icon name={icon} size={14} />
                <span className="nav-item-label">{label}</span>
              </span>
              <span className="nav-count">{count}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-divider" />
      </div>

      <FadeScroll
        className="sidebar-scroll"
        label={t("contacts.groupsScrollLabel")}
      >
        <div className="nav-section">
          <div className="sidebar-section-head">
            <span>{t("contacts.groupsSection")}</span>
          </div>
          {CONTACT_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={`nav-item${groupFilter === g ? " active" : ""}`}
              onClick={() => {
                onSelectNav("all");
                onSelectGroup(groupFilter === g ? null : g);
              }}
            >
              <span className="nav-item-main">
                <Icon name="tag" size={13} />
                <span className="nav-item-label">{localizeGroup(g)}</span>
              </span>
              <span className="nav-count">
                {workspace.contacts.filter((c) => c.groups.includes(g)).length}
              </span>
            </button>
          ))}
        </div>

        <div className="nav-section">
          <div className="sidebar-section-head">
            <span>{t("contacts.byAccountSection")}</span>
          </div>
          {workspace.accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              className={`nav-item${accountFilter === acc.id ? " active" : ""}`}
              onClick={() =>
                onSelectAccount(accountFilter === acc.id ? null : acc.id)
              }
            >
              <span className="nav-item-main">
                <ProviderIcon provider={acc.provider} size={16} />
                <span className="nav-item-label">
                  {localizeText(acc.shortTag)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </FadeScroll>
    </aside>
  );
}
