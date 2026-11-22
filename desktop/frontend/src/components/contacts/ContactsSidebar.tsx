import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";

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

  const navItems: Array<readonly [ContactNavFilter, string, number, string]> = [
    ["all", "全部联系人", workspace.contacts.length, "users"],
    [
      "vip",
      "VIP 重要发件人",
      workspace.contacts.filter((c) => c.vip).length,
      "star",
    ],
    [
      "frequent",
      "高频往来",
      workspace.contacts.filter((c) => c.mailCount >= 20).length,
      "zap",
    ],
    ["recent", "最近联系", workspace.contacts.length, "clock"],
    ["blacklist", "黑名单与拦截", workspace.blacklist.length, "ban"],
  ];

  if (viewport === "compact") {
    return (
      <aside
        className="panel-card icon-rail-pane"
        aria-label="联系人紧凑图标导航"
      >
        <div className="icon-rail-stack">
          <button
            type="button"
            className="icon-rail-btn icon-rail-trigger"
            onClick={() => workspace.setScreen("mail")}
            title="返回统一收件箱"
            aria-label="返回统一收件箱"
          >
            <Icon name="arrowLeft" size={15} />
          </button>

          <button
            type="button"
            className="icon-rail-compose"
            onClick={() => workspace.setOverlay({ type: "contact-edit" })}
            title="新建联系人"
            aria-label="新建联系人"
          >
            <Icon name="plus" size={15} />
          </button>

          <div className="icon-rail-divider" />

          {navItems.map(([id, label, , icon]) => (
            <button
              key={id}
              type="button"
              className={`icon-rail-btn ${navFilter === id && !groupFilter ? "active" : ""}`}
              onClick={() => {
                onSelectNav(id);
                onSelectGroup(null);
              }}
              title={label}
              aria-label={label}
            >
              <Icon name={icon} size={15} />
            </button>
          ))}
        </div>

        <div className="icon-rail-stack">
          <button
            type="button"
            className="profile-avatar icon-rail-avatar"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "accounts" })
            }
            title="陆星河"
            aria-label="陆星河"
          >
            陆
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel-card sidebar-pane" aria-label="联系人筛选导航">
      <div className="sidebar-core-fixed">
        <button
          type="button"
          className="compose-cta"
          onClick={() => workspace.setOverlay({ type: "contact-edit" })}
        >
          <Icon name="plus" size={15} />
          <span>新建联系人</span>
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() => workspace.setScreen("mail")}
        >
          <span className="nav-item-main">
            <Icon name="arrowLeft" size={14} />
            <span className="nav-item-label">返回统一收件箱</span>
          </span>
        </button>

        <div className="sidebar-section-head">
          <span>联系人视图</span>
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

      <div className="sidebar-scroll">
        <div className="nav-section">
          <div className="sidebar-section-head">
            <span>联系人分组</span>
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
                <span className="nav-item-label">{g}</span>
              </span>
              <span className="nav-count">
                {workspace.contacts.filter((c) => c.groups.includes(g)).length}
              </span>
            </button>
          ))}
        </div>

        <div className="nav-section">
          <div className="sidebar-section-head">
            <span>按邮箱来源</span>
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
                <span className="nav-item-label">{acc.shortTag}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
