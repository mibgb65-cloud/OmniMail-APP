import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { useState } from "react";
import { useApp } from "../../state/AppContext";
import type { SettingsTabId } from "../../types/settings";
import { Icon } from "../common/Icon";
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
import { settingsNav } from "./settingsNav";

export function SettingsModal({
  initialTab,
  initialAccountId,
}: {
  initialTab: SettingsTabId;
  initialAccountId?: string;
}) {
  const { workspace } = useApp();
  const [tab, setTab] = useState<SettingsTabId>(
    initialTab === "account-detail" ? "accounts" : initialTab,
  );
  const [accountId, setAccountId] = useState<string | undefined>(
    initialAccountId,
  );
  const [query, setQuery] = useState("");
  const visibleTabs = settingsNav.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const activeMeta =
    settingsNav.find((item) => item.id === tab) ?? settingsNav[0];
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
        aria-label="偏好设置"
      >
        <nav className="settings-nav" aria-label="设置分类导航">
          <div className="settings-nav-top">
            <div className="settings-nav-title">设置</div>
            <input
              type="search"
              className="input"
              style={{ height: 32 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索设置项…"
            />
          </div>
          <FadeScroll
            className="settings-nav-scroll"
            surface="--bg-surface"
            label="设置分类"
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
              关于 OmniMail
            </div>
            <div
              className="text-xs text-muted truncate"
              style={{ width: "100%" }}
            >
              版本 0.1.0
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
                  ? "连接模型服务，并控制邮件内容的使用范围"
                  : "调整外观、语言、桌面窗口行为与本地存储偏好"}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              style={{ width: 30, height: 30, flexShrink: 0 }}
              aria-label="关闭设置"
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
              <span className="text-muted">更改即时生效</span>
            </span>
            <span
              className="text-xs text-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Esc 关闭
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
