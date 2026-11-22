import { useState } from "react";
import { useApp } from "../../state/AppContext";
import type { SettingsTabId } from "../../types/settings";
import { Icon } from "../common/Icon";
import { AccountsTab } from "./AccountsTab";
import { AiSettingsTab } from "./AiSettingsTab";
import { AutoReplyTab } from "./AutoReplyTab";
import { ComposeTab } from "./ComposeTab";
import { GeneralTab } from "./GeneralTab";
import { PrivacyTab, StorageTab } from "./PrivacyAndStorageTabs";
import { RulesTab } from "./RulesTab";
import { AboutTab, ShortcutsTab } from "./ShortcutsAndAboutTabs";
import { SyncTab } from "./SyncTab";

const NAV_ITEMS: Array<{ id: SettingsTabId; label: string; icon: string }> = [
  { id: "general", label: "通用", icon: "sliders" },
  { id: "accounts", label: "邮箱账户", icon: "mail" },
  { id: "sync", label: "收信与同步", icon: "refresh" },
  { id: "compose", label: "写信与签名", icon: "pen" },
  { id: "rules", label: "收件规则", icon: "rule" },
  { id: "auto-reply", label: "自动回复", icon: "autoReply" },
  { id: "ai", label: "AI 助手", icon: "sparkle" },
  { id: "privacy", label: "隐私与安全", icon: "shield" },
  { id: "storage", label: "存储与数据", icon: "database" },
  { id: "shortcuts", label: "快捷键", icon: "keyboard" },
  { id: "about", label: "关于 OmniMail", icon: "info" },
];

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

  const visibleTabs = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const activeMeta = NAV_ITEMS.find((item) => item.id === tab) ?? NAV_ITEMS[0];

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

          <div className="settings-nav-scroll">
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
          </div>

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
              <h2 className="modal-title truncate">{activeMeta.label}</h2>
              <div className="modal-sub truncate">
                调整外观、语言、桌面窗口行为与本地存储偏好
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
          <div className="modal-body">{renderTabBody()}</div>
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
