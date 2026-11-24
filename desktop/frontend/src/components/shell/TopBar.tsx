import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { TopBarSyncChip } from "./TopBarSyncChip";
import { WindowControls, handleDragRegionDoubleClick } from "./WindowControls";

export function TopBar() {
  const { viewport, workspace, mailStore } = useApp();
  const { t } = useI18n();
  const { settings, screen } = workspace;
  const isCompact = viewport === "compact";
  const isLaptop = viewport === "laptop";

  const searchPlaceholder =
    screen === "contacts"
      ? t("topbar.searchContactsPlaceholder")
      : t("topbar.searchMailPlaceholder");

  return (
    <header className="topbar" onDoubleClick={handleDragRegionDoubleClick}>
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-brand-btn"
          onClick={() => workspace.setScreen("mail")}
          aria-label={t("topbar.backToInbox")}
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
            aria-label={t("topbar.clearSearch")}
          >
            <Icon name="x" size={12} />
          </button>
        )}
        <Tooltip label={t("topbar.advancedSearch")}>
          <button
            type="button"
            className="icon-btn topbar-mini-icon"
            onClick={() => workspace.setOverlay({ type: "advanced-search" })}
            aria-label={t("topbar.advancedSearch")}
          >
            <Icon name="filter" size={13} />
          </button>
        </Tooltip>
        <Tooltip label={t("topbar.commandPalette")} shortcut="Ctrl+K">
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
          <Tooltip label={t("topbar.switchLanguage")}>
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
                    ? t("topbar.langLabelShortZh")
                    : t("topbar.langLabelFullZh")
                  : isLaptop
                    ? t("topbar.langLabelShortEn")
                    : t("topbar.langLabelFullEn")}
              </span>
              {!isLaptop && <Icon name="chevronDown" size={12} />}
            </button>
          </Tooltip>
        )}

        <div
          className="theme-segmented"
          role="group"
          aria-label={t("topbar.themeGroup")}
        >
          <span className="theme-seg-indicator" aria-hidden="true" />
          <Tooltip label={t("topbar.toggleTheme")}>
            <button
              type="button"
              className="theme-seg-btn"
              data-seg-theme="light"
              onClick={workspace.toggleTheme}
              aria-label={t("topbar.lightMode")}
            >
              <Icon name="sun" size={14} />
            </button>
          </Tooltip>
          <Tooltip label={t("topbar.toggleTheme")}>
            <button
              type="button"
              className="theme-seg-btn"
              data-seg-theme="dark"
              onClick={workspace.toggleTheme}
              aria-label={t("topbar.darkMode")}
            >
              <Icon name="moon" size={14} />
            </button>
          </Tooltip>
        </div>

        <Tooltip label={t("topbar.settingsTooltip")} shortcut="Ctrl+,">
          <button
            type="button"
            className="icon-btn icon-btn-bordered topbar-settings-btn"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "general" })
            }
            aria-label={t("topbar.openSettings")}
          >
            <Icon name="settings" size={15} />
          </button>
        </Tooltip>

        <WindowControls />
      </div>
    </header>
  );
}
