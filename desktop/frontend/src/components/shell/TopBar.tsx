import { useApp } from "../../state/AppContext";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { TopBarSyncChip } from "./TopBarSyncChip";
import { WindowControls, handleDragRegionDoubleClick } from "./WindowControls";

export function TopBar() {
  const { viewport, workspace, mailStore } = useApp();
  const { settings, screen } = workspace;
  const isCompact = viewport === "compact";
  const isLaptop = viewport === "laptop";

  const searchPlaceholder =
    screen === "contacts"
      ? "搜索联系人姓名、邮箱、公司或分组…"
      : "搜索所有邮箱、联系人、主题或附件…";

  return (
    <header className="topbar" onDoubleClick={handleDragRegionDoubleClick}>
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-brand-btn"
          onClick={() => workspace.setScreen("mail")}
          aria-label="返回统一收件箱"
        >
          <BrandLogo size={28} showWordmark />
        </button>

        <TopBarSyncChip />
      </div>

      <div className="topbar-search-wrap">
        <Icon name="search" size={14} />
        <input
          className="topbar-search-input"
          value={mailStore.searchQuery}
          onChange={(e) => {
            if (screen !== "mail") workspace.setScreen("mail");
            mailStore.setSearchQuery(e.target.value);
          }}
          placeholder={searchPlaceholder}
        />
        {mailStore.searchQuery && (
          <button
            type="button"
            className="icon-btn topbar-mini-icon"
            onClick={() => mailStore.setSearchQuery("")}
            aria-label="清空搜索"
          >
            <Icon name="x" size={12} />
          </button>
        )}
        <Tooltip label="高级搜索筛选">
          <button
            type="button"
            className="icon-btn topbar-mini-icon"
            onClick={() => workspace.setOverlay({ type: "advanced-search" })}
            aria-label="高级搜索筛选"
          >
            <Icon name="filter" size={13} />
          </button>
        </Tooltip>
        <Tooltip label="打开全局命令面板" shortcut="Ctrl+K">
          <button
            type="button"
            className="kbd topbar-kbd"
            onClick={() => workspace.setOverlay({ type: "command-palette" })}
          >
            Ctrl K
          </button>
        </Tooltip>
      </div>

      <div className="topbar-right">
        {!isCompact && (
          <Tooltip label="切换界面显示语言">
            <button
              type="button"
              className="btn btn-secondary topbar-lang-btn"
              onClick={() =>
                workspace.updateSettings({
                  language: settings.language === "zh-CN" ? "en-US" : "zh-CN",
                })
              }
            >
              <Icon name="globe" size={14} />
              <span>
                {settings.language === "zh-CN"
                  ? isLaptop
                    ? "中文"
                    : "简体中文"
                  : isLaptop
                    ? "EN"
                    : "English"}
              </span>
              {!isLaptop && <Icon name="chevronDown" size={12} />}
            </button>
          </Tooltip>
        )}

        <div className="theme-segmented" role="group" aria-label="外观模式切换">
          <span className="theme-seg-indicator" aria-hidden="true" />
          <Tooltip label="切换浅色 / 暗色外观">
            <button
              type="button"
              className="theme-seg-btn"
              data-seg-theme="light"
              onClick={workspace.toggleTheme}
              aria-label="浅色模式"
            >
              <Icon name="sun" size={14} />
            </button>
          </Tooltip>
          <Tooltip label="切换浅色 / 暗色外观">
            <button
              type="button"
              className="theme-seg-btn"
              data-seg-theme="dark"
              onClick={workspace.toggleTheme}
              aria-label="暗色模式"
            >
              <Icon name="moon" size={14} />
            </button>
          </Tooltip>
        </div>

        <Tooltip label="偏好设置" shortcut="Ctrl+,">
          <button
            type="button"
            className="icon-btn icon-btn-bordered topbar-settings-btn"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "general" })
            }
            aria-label="打开偏好设置"
          >
            <Icon name="settings" size={15} />
          </button>
        </Tooltip>

        <WindowControls />
      </div>
    </header>
  );
}
