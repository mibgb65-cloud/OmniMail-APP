import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { resolveConciseAgentTitle } from "../../utils/agentMailFormat";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";

export function SidebarWorkBuddySection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, workBuddyStore } = useApp();
  const { t } = useI18n();
  const { accounts, activeAccount, messages } = workBuddyStore;

  if (accounts.length === 0) {
    return null;
  }

  return (
    <>
      <div className="sidebar-divider" />
      <div className="nav-section">
        <div className="nav-section-head">
          <span className="truncate">{t("workbuddy.sidebarSectionTitle")}</span>
          <span>{accounts.length}</span>
        </div>

        {accounts.map((acc) => {
          const isCurrent = activeAccount?.accountId === acc.accountId;
          const active = workspace.screen === "workbuddy" && isCurrent;
          const displayName = resolveConciseAgentTitle(
            acc.accountName,
            "workbuddy",
          );
          const unreadCount = isCurrent
            ? messages.filter((m) => !m.isRead).length
            : 0;

          return (
            <Tooltip
              key={acc.accountId}
              label={`${displayName} · ${acc.email}`}
              badge={unreadCount}
              placement="right"
            >
              <button
                type="button"
                className={`account-row ${active ? "active" : ""}`}
                aria-pressed={active}
                aria-label={t("workbuddy.sidebarEntryAria", {
                  name: displayName,
                })}
                onClick={() => {
                  workBuddyStore.selectAccount(acc.accountId);
                  onNavigate?.();
                }}
              >
                <ProviderIcon provider="workbuddy" size={28} />
                <div className="account-row-meta">
                  <span className="account-row-name truncate">
                    {displayName}
                  </span>
                  <span className="account-row-sub truncate">{acc.email}</span>
                </div>
                <div className="account-row-stats">
                  <span className="account-status-line">
                    <span
                      className="account-status-dot"
                      data-status="connected"
                      aria-hidden="true"
                    />
                  </span>
                  {unreadCount > 0 && (
                    <span className="account-unread-count">{unreadCount}</span>
                  )}
                </div>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </>
  );
}
