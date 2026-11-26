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
import { SettingsSidebarNav } from "./SettingsSidebarNav";
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
        <SettingsSidebarNav
          tab={tab}
          query={query}
          visibleTabs={visibleTabs}
          onQueryChange={setQuery}
          onSelectTab={(nextTab) => {
            setTab(nextTab);
            if (nextTab !== "accounts") setAccountId(undefined);
          }}
        />

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
                  : tab === "about"
                    ? t("updater.aboutHeaderSub")
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
