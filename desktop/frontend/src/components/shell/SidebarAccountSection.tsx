import { useI18n, type TranslationKey } from "../../i18n";
import { resolveAccountActionOverlay } from "../../state/accountSyncState";
import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";

const STATUS_KEYS: Record<EmailAccount["status"], TranslationKey> = {
  connected: "sidebar.statusConnected",
  syncing: "sidebar.statusSyncing",
  "auth-expired": "sidebar.statusAuthExpired",
  error: "sidebar.statusError",
};

export function SidebarAccountSection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, mailStore } = useApp();
  const { t, formatTime, localizeText } = useI18n();
  const { accounts } = workspace;
  const { activeAccountId } = mailStore;

  return (
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
          const isError = acc.status === "error";
          const isAuth = acc.status === "auth-expired";
          const hasIssue = isError || isAuth;
          const statusLabel = t(
            STATUS_KEYS[acc.status] ?? "sidebar.statusError",
          );
          const subText = isAuth
            ? t("topbar.sidebarSubAuthExpired", {
                time: formatTime(acc.lastSyncedAt),
              })
            : isError
              ? t("topbar.sidebarSubBlocked", {
                  time: formatTime(acc.lastSyncedAt),
                })
              : localizeText(acc.providerLabel || acc.email);

          return (
            <Tooltip
              key={acc.id}
              label={
                acc.lastError && hasIssue
                  ? `${acc.name} · ${acc.lastError}`
                  : `${acc.name} · ${acc.email} · ${statusLabel}`
              }
              badge={acc.unreadCount}
              placement="right"
            >
              <div
                className={`account-row ${active ? "active" : ""}`}
                data-status={acc.status}
              >
                <button
                  type="button"
                  className="account-row-main-btn"
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
                    <span
                      className="account-row-sub truncate"
                      data-status={acc.status}
                    >
                      {subText}
                    </span>
                  </div>
                </button>

                {hasIssue ? (
                  <button
                    type="button"
                    className="account-issue-pill"
                    data-status={acc.status}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.();
                      workspace.setOverlay(
                        resolveAccountActionOverlay(
                          acc,
                          isAuth ? "reauth" : "diagnostics",
                        ),
                      );
                    }}
                  >
                    <span className="account-issue-dot" aria-hidden="true" />
                    <span>
                      {t(
                        isAuth
                          ? "topbar.sidebarPillReconnect"
                          : "topbar.sidebarPillDiagnose",
                      )}
                    </span>
                  </button>
                ) : (
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
                )}
              </div>
            </Tooltip>
          );
        })
      )}
    </div>
  );
}
