import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { SettingsTabId } from "../../types/settings";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { AccountsTab } from "./AccountsTab";
import { AiSettingsModeBadge, AiSettingsTab } from "./AiSettingsTab";
import { AutoReplyTab } from "./AutoReplyTab";
import { ComposeTab } from "./ComposeTab";
import { GeneralTab } from "./GeneralTab";
import { PrivacyTab } from "./PrivacyTab";
import { RulesTab } from "./RulesTab";
import { AboutTab, ShortcutsTab } from "./ShortcutsAndAboutTabs";
import { StorageTab } from "./StorageTab";
import { SyncTab } from "./SyncTab";
import { TranslationSettingsTab } from "./TranslationSettingsTab";
import { getSettingsNav } from "./settingsNav";

export function SettingsModal({
  initialTab,
  initialAccountId,
}: {
  initialTab: SettingsTabId;
  initialAccountId?: string;
}) {
  const { workspace } = useApp();
  const { t } = useI18n();
  const [tab, setTab] = useState<SettingsTabId>(
    initialTab === "account-detail" ? "accounts" : initialTab,
  );
  const [accountId, setAccountId] = useState<string | undefined>(
    initialAccountId,
  );
  const [query, setQuery] = useState("");
  const navItems = getSettingsNav(t);
  const visibleTabs = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const activeMeta = navItems.find((item) => item.id === tab) ?? navItems[0];
  const renderTabBody = () => {
    switch (tab) {
      case "general":
        return <GeneralTab />;
      case "accounts":
      case "account-detail":
        return (
          <AccountsTab
            selectedAccountId={accountId}
            onSelectAccount={(id) => setAccountId(id)}
          />
        );
      case "sync":
        return <SyncTab />;
      case "compose":
        return <ComposeTab />;
      case "rules":
        return <RulesTab />;
      case "auto-reply":
        return <AutoReplyTab />;
      case "ai":
        return <AiSettingsTab />;
      case "translation":
        return <TranslationSettingsTab onOpenAi={() => setTab("ai")} />;
      case "privacy":
        return <PrivacyTab />;
      case "storage":
        return <StorageTab />;
      case "shortcuts":
        return <ShortcutsTab />;
      case "about":
        return <AboutTab />;
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget)
          workspace.setOverlay({ type: "none" });
      }}
    >
      <div
        className="modal-card settings-shell"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.modalAria")}
      >
        <nav className="settings-nav" aria-label={t("settings.navAria")}>
          <div className="settings-nav-top">
            <div className="settings-nav-title">{t("settings.navTitle")}</div>
            <input
              type="search"
              className="input"
              style={{ height: 32 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                onClick={() => {
                  setTab(item.id);
                  if (item.id !== "accounts") setAccountId(undefined);
                }}
              >
                <span className="nav-item-main">
                  <Icon name={item.icon} size={14} />
                  <span className="nav-item-label">{item.label}</span>
                </span>
                {item.id === "accounts" && (
                  <span className="nav-count">{workspace.accounts.length}</span>
                )}
              </button>
            ))}
          </FadeScroll>

          <button
            type="button"
            className="sidebar-footer-card"
            style={{ width: "100%", textAlign: "left", flexShrink: 0 }}
            onClick={() => setTab("about")}
          >
            <div
              className="truncate"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-ink)",
                width: "100%",
              }}
            >
              {t("settings.footerAboutTitle")}
            </div>
            <div
              className="text-xs text-muted truncate"
              style={{ width: "100%" }}
            >
              {t("settings.footerVersion", { version: "0.1.0" })}
            </div>
          </button>
        </nav>

        <section className="settings-content">
          <div className="modal-header">
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <h2 className="modal-title truncate">{activeMeta.label}</h2>
                {tab === "ai" && <AiSettingsModeBadge />}
              </div>
              <div className="modal-sub truncate">
                {tab === "ai"
                  ? t("settings.headerSubAi")
                  : t("settings.headerSubDefault")}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              style={{ width: 30, height: 30, flexShrink: 0 }}
              aria-label={t("settings.closeSettingsAria")}
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <FadeScroll className="modal-body" label={activeMeta.label}>
            <div key={tab} className="settings-tab-stage">
              {renderTabBody()}
            </div>
          </FadeScroll>
          <div className="modal-footer settings-modal-footer">
            <span className="row" style={{ gap: 6, fontSize: 12 }}>
              <span className="status-dot" />
              <span className="text-muted">
                {t("settings.changesApplyInstantly")}
              </span>
            </span>
            <span
              className="text-xs text-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {t("settings.escToClose")}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
