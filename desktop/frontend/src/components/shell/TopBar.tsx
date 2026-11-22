import { useApp } from "../../state/AppContext";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";
import { WindowControls, handleDragRegionDoubleClick } from "./WindowControls";

export function TopBar() {
  const { viewport, workspace, mailStore, triggerSyncAll } = useApp();
  const { settings, bannerMode, syncLabel, screen } = workspace;

  const isOffline = bannerMode === "offline";
  const isAuthExpired = bannerMode === "auth-expired";
  const isCompact = viewport === "compact";
  const isLaptop = viewport === "laptop";

  const syncText = isOffline
    ? isCompact
      ? "离线"
      : "离线 · 本地缓存"
    : isAuthExpired
      ? isCompact
        ? "需重授权"
        : "1 个邮箱需重新授权"
      : isCompact
        ? syncLabel === "所有邮箱已同步"
          ? "已同步"
          : "同步中"
        : isLaptop && syncLabel === "所有邮箱已同步"
          ? `${workspace.accounts.length} 邮箱已同步`
          : syncLabel;

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

        <button
          type="button"
          className="sync-status-chip"
          onClick={() => triggerSyncAll()}
          title="点击立即同步全部邮箱"
        >
          <span
            className={`status-dot ${isAuthExpired ? "danger" : isOffline ? "warning" : ""}`}
          />
          <span className="truncate">{syncText}</span>
        </button>
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
        <button
          type="button"
          className="icon-btn topbar-mini-icon"
          onClick={() => workspace.setOverlay({ type: "advanced-search" })}
          title="高级搜索筛选"
          aria-label="高级搜索筛选"
        >
          <Icon name="filter" size={13} />
        </button>
        <button
          type="button"
          className="kbd topbar-kbd"
          onClick={() => workspace.setOverlay({ type: "command-palette" })}
          title="打开全局命令面板"
        >
          Ctrl K
        </button>
      </div>

      <div className="topbar-right">
        {!isCompact && (
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
        )}

        <div className="theme-segmented" role="group" aria-label="外观模式切换">
          <button
            type="button"
            className={`theme-seg-btn ${settings.theme === "light" ? "active" : ""}`}
            onClick={() => workspace.updateSettings({ theme: "light" })}
            title="浅色模式"
            aria-label="浅色模式"
          >
            <Icon name="sun" size={14} />
          </button>
          <button
            type="button"
            className={`theme-seg-btn ${settings.theme === "dark" ? "active" : ""}`}
            onClick={() => workspace.updateSettings({ theme: "dark" })}
            title="暗色模式"
            aria-label="暗色模式"
          >
            <Icon name="moon" size={14} />
          </button>
        </div>

        <button
          type="button"
          className="icon-btn icon-btn-bordered topbar-settings-btn"
          onClick={() =>
            workspace.setOverlay({ type: "settings", tab: "general" })
          }
          title="偏好设置 (Ctrl+,)"
          aria-label="打开偏好设置"
        >
          <Icon name="settings" size={15} />
        </button>

        <WindowControls />
      </div>
    </header>
  );
}
