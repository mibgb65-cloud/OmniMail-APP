import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { SettingsTabId } from "../../types/settings";
import { formatVersionTag } from "../../utils/updateFormat";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import type { getSettingsNav } from "./settingsNav";

export function SettingsSidebarNav({
  tab,
  query,
  visibleTabs,
  onQueryChange,
  onSelectTab,
}: {
  tab: SettingsTabId;
  query: string;
  visibleTabs: ReturnType<typeof getSettingsNav>;
  onQueryChange: (val: string) => void;
  onSelectTab: (id: SettingsTabId) => void;
}) {
  const { workspace, updateStore } = useApp();
  const { t } = useI18n();
  const hasUpdate = updateStore.chipVisible;
  const updateTone =
    updateStore.flowState === "ready" || updateStore.flowState === "installing"
      ? "ready"
      : "accent";

  return (
    <nav className="settings-nav" aria-label={t("settings.navAria")}>
      <div className="settings-nav-top">
        <div className="settings-nav-title">{t("settings.navTitle")}</div>
        <input
          type="search"
          className="input"
          style={{ height: 32 }}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("settings.searchPlaceholder")}
        />
      </div>

      <FadeScroll
        className="settings-nav-scroll"
        surface="--bg-surface"
        label={t("settings.navScrollLabel")}
      >
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${tab === item.id ? " active" : ""}`}
            onClick={() => onSelectTab(item.id)}
          >
            <span className="nav-item-main">
              <Icon name={item.icon} size={14} />
              <span className="nav-item-label">{item.label}</span>
            </span>
            {item.id === "accounts" && (
              <span className="nav-count">{workspace.accounts.length}</span>
            )}
            {item.id === "about" && hasUpdate && (
              <span
                className="settings-nav-update-dot"
                data-tone={updateTone}
              />
            )}
          </button>
        ))}
      </FadeScroll>

      <button
        type="button"
        className="sidebar-footer-card"
        style={{ width: "100%", textAlign: "left", flexShrink: 0 }}
        onClick={() => onSelectTab("about")}
      >
        <div className="row-between" style={{ width: "100%", gap: 6 }}>
          <span className="settings-footer-title truncate">
            {t("settings.footerAboutTitle")}
          </span>
          {hasUpdate && (
            <span
              className="settings-footer-update-pill"
              data-tone={updateTone}
            >
              {t("updater.aboutFooterHasUpdate")}
            </span>
          )}
        </div>
        <div className="text-xs text-muted truncate" style={{ width: "100%" }}>
          {t("settings.footerVersion", {
            version: formatVersionTag(updateStore.buildInfo.version),
          })}
        </div>
      </button>
    </nav>
  );
}
