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

  return (
    <aside
      className="panel-card icon-rail-pane"
      aria-label="联系人紧凑图标导航"
    >
      <div className="icon-rail-stack">
        <Tooltip label="返回统一收件箱" shortcut="G I" placement="right">
          <button
            type="button"
            className="icon-rail-btn icon-rail-trigger"
            onClick={() => workspace.setScreen("mail")}
            aria-label="返回统一收件箱"
          >
            <Icon name="arrowLeft" size={15} />
          </button>
        </Tooltip>

        <Tooltip label="新建联系人" placement="right">
          <button
            type="button"
            className="icon-rail-compose"
            onClick={() => workspace.setOverlay({ type: "contact-edit" })}
            aria-label="新建联系人"
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
        <Tooltip label="陆星河 · 管理工作空间与账户" placement="right">
          <button
            type="button"
            className="profile-avatar icon-rail-avatar"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "accounts" })
            }
            aria-label="陆星河"
          >
            陆
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
