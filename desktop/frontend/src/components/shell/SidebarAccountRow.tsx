import { useI18n, type TranslationKey } from "../../i18n";
import { resolveAccountActionOverlay } from "../../state/accountSyncState";
import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import { resolveSidebarAccountTitle } from "../../utils/accountDisplay";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";

const STATUS_KEYS: Record<EmailAccount["status"], TranslationKey> = {
  connected: "sidebar.statusConnected",
  syncing: "sidebar.statusSyncing",
  "auth-expired": "sidebar.statusAuthExpired",
  error: "sidebar.statusError",
};

export function SidebarAccountRow({
  account: acc,
  active,
  isRenaming,
  onNavigate,
  onOpenRename,
  onOpenContextMenu,
}: {
  account: EmailAccount;
  active: boolean;
  isRenaming: boolean;
  onNavigate?: () => void;
  onOpenRename: (rect: DOMRect) => void;
  onOpenContextMenu: (x: number, y: number, rowRect: DOMRect) => void;
}) {
  const { workspace, mailStore } = useApp();
  const { lang, t, formatTime } = useI18n();

  const isError = acc.status === "error";
  const isAuth = acc.status === "auth-expired";
  const hasIssue = isError || isAuth;
  const displayTitle = resolveSidebarAccountTitle(acc, lang);
  const statusLabel = t(STATUS_KEYS[acc.status] ?? "sidebar.statusError");
  const subText = isAuth
    ? t("topbar.sidebarSubAuthExpired", {
        time: formatTime(acc.lastSyncedAt),
      })
    : isError
      ? t("topbar.sidebarSubBlocked", {
          time: formatTime(acc.lastSyncedAt),
        })
      : acc.email;

  return (
    <Tooltip
      label={
        acc.lastError && hasIssue
          ? `${displayTitle} · ${acc.lastError}`
          : `${displayTitle} · ${acc.email} · ${statusLabel}`
      }
      badge={acc.unreadCount}
      placement="right"
    >
      <div
        className={`account-row ${active ? "active" : ""} ${isRenaming ? "is-renaming" : ""}`}
        data-status={acc.status}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenContextMenu(
            e.clientX,
            e.clientY,
            e.currentTarget.getBoundingClientRect(),
          );
        }}
      >
        <button
          type="button"
          className="account-row-main-btn"
          aria-pressed={active}
          aria-label={t("sidebar.accountUnreadAria", {
            name: displayTitle,
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
            <span className="account-row-name truncate">{displayTitle}</span>
            <span className="account-row-sub truncate" data-status={acc.status}>
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
          <div className="account-row-tail">
            <div className="account-row-stats">
              <span className="account-status-line">
                <span
                  className="account-status-dot"
                  data-status={acc.status}
                  aria-hidden="true"
                />
              </span>
              <span className="account-unread-count">{acc.unreadCount}</span>
            </div>
            <button
              type="button"
              className="account-rename-btn"
              aria-label={t("sidebar.renameAccountBtn")}
              onClick={(e) => {
                e.stopPropagation();
                const row = e.currentTarget.closest(".account-row");
                if (row) onOpenRename(row.getBoundingClientRect());
              }}
            >
              <Icon name="pencil" size={12} />
            </button>
          </div>
        )}
      </div>
    </Tooltip>
  );
}
