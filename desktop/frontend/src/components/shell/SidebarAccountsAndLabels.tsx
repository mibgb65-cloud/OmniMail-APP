import { useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";
import { SidebarMuseSection } from "./SidebarMuseSection";

const STATUS_KEYS: Record<EmailAccount["status"], TranslationKey> = {
  connected: "sidebar.statusConnected",
  syncing: "sidebar.statusSyncing",
  "auth-expired": "sidebar.statusAuthExpired",
  error: "sidebar.statusError",
};

export function SidebarAccountsAndLabels({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, mailStore } = useApp();
  const { t, localizeText } = useI18n();
  const { accounts } = workspace;
  const { labels, activeAccountId, activeLabelId } = mailStore;

  return (
    <>
      <div className="nav-section">
        <div className="nav-section-head">
          <span className="truncate">
            {t("sidebar.accounts")} ({accounts.length})
          </span>
          <button
            type="button"
            className="nav-section-action"
            onClick={() => {
              onNavigate?.();
              workspace.setOverlay({ type: "add-account" });
            }}
          >
            <Icon name="plus" size={12} /> {t("sidebar.addAccountBtn")}
          </button>
        </div>
        {accounts.length === 0 ? (
          <button
            type="button"
            className="account-empty-card"
            onClick={() => {
              onNavigate?.();
              workspace.setOverlay({ type: "add-account" });
            }}
          >
            <div className="account-empty-head">
              <span className="account-empty-plus" aria-hidden="true">
                <Icon name="plus" size={16} />
              </span>
              <div className="account-empty-meta">
                <span className="account-empty-title truncate">
                  {t("sidebar.noAccountsTitle")}
                </span>
                <span className="account-empty-sub truncate">
                  {t("sidebar.noAccountsSub")}
                </span>
              </div>
            </div>
            <span className="account-empty-cta">
              <Icon name="plus" size={12} /> {t("sidebar.addFirstAccount")}
            </span>
          </button>
        ) : (
          accounts.map((acc) => {
            const active =
              workspace.screen === "mail" && activeAccountId === acc.id;
            const statusLabel = t(
              STATUS_KEYS[acc.status] ?? "sidebar.statusError",
            );
            return (
              <Tooltip
                key={acc.id}
                label={`${acc.name} · ${acc.email} · ${statusLabel}`}
                badge={acc.unreadCount}
                placement="right"
              >
                <button
                  type="button"
                  className={`account-row ${active ? "active" : ""}`}
                  aria-pressed={active}
                  aria-label={t("sidebar.accountUnreadAria", {
                    name: acc.name,
                    status: statusLabel,
                    count: acc.unreadCount,
                  })}
                  onClick={() => {
                    workspace.setScreen("mail");
                    mailStore.selectAccount(acc.id);
                    onNavigate?.();
                  }}
                >
                  <ProviderIcon provider={acc.provider} size={28} />
                  <div className="account-row-meta">
                    <span className="account-row-name truncate">
                      {acc.name}
                    </span>
                    <span className="account-row-sub truncate">
                      {localizeText(acc.providerLabel || acc.email)}
                    </span>
                  </div>
                  <div className="account-row-stats">
                    <span className="account-status-line">
                      <span
                        className="account-status-dot"
                        data-status={acc.status}
                        aria-hidden="true"
                      />
                    </span>
                    <span
                      className="account-unread-count"
                      aria-label={t("mailList.tabUnreadCount", {
                        count: acc.unreadCount,
                      })}
                    >
                      {acc.unreadCount}
                    </span>
                  </div>
                </button>
              </Tooltip>
            );
          })
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="nav-section">
        <div className="nav-section-head">
          <span>{t("sidebar.labels")}</span>
          <Tooltip label={t("sidebar.manageLabelsTip")} placement="right">
            <button
              type="button"
              className="nav-section-action"
              onClick={() => {
                onNavigate?.();
                workspace.setOverlay({ type: "label-manage", mode: "create" });
              }}
              aria-label={t("sidebar.manageLabelsAria")}
            >
              <Icon name="plus" size={13} />
            </button>
          </Tooltip>
        </div>
        {labels.map((lbl) => (
          <button
            key={lbl.id}
            type="button"
            className={`nav-item ${workspace.screen === "mail" && activeLabelId === lbl.id ? "active" : ""}`}
            onClick={() => {
              workspace.setScreen("mail");
              mailStore.selectLabel(lbl.id);
              onNavigate?.();
            }}
          >
            <span className="nav-item-main">
              <span className="label-dot" style={{ background: lbl.color }} />
              <span className="nav-item-label">{localizeText(lbl.name)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="nav-section">
        <button
          type="button"
          className="nav-item"
          onClick={() => {
            onNavigate?.();
            workspace.setScreen("contacts");
          }}
        >
          <span className="nav-item-main">
            <Icon name="users" size={14} />
            <span className="nav-item-label">
              {t("sidebar.contactsAndVip")}
            </span>
          </span>
          <span className="nav-count">{workspace.contacts.length}</span>
        </button>
      </div>

      <SidebarMuseSection onNavigate={onNavigate} />
    </>
  );
}
