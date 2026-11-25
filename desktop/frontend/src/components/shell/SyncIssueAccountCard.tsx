import { useI18n } from "../../i18n";
import {
  formatAccountSyncReason,
  resolveAccountActionOverlay,
} from "../../state/accountSyncState";
import { useApp } from "../../state/AppContext";
import type { EmailAccount } from "../../types/account";
import { ProviderIcon } from "../common/ProviderIcon";

export function SyncIssueAccountCard({
  account,
  onClosePopover,
}: {
  account: EmailAccount;
  onClosePopover: () => void;
}) {
  const { workspace, triggerSyncAccount } = useApp();
  const { lang, t, formatTime } = useI18n();
  const isAuth = account.status === "auth-expired";

  return (
    <div className="ssp-issue-card" data-status={account.status}>
      <div className="ssp-card-top">
        <div className="ssp-card-ident">
          <span className="ssp-provider-box" data-status={account.status}>
            <ProviderIcon provider={account.provider} size={20} bare />
          </span>
          <div className="ssp-card-meta">
            <span className="ssp-card-name truncate">{account.name}</span>
            <span className="ssp-card-sub truncate">
              {t(
                isAuth ? "topbar.popCardAuthMeta" : "topbar.popCardBlockedMeta",
                {
                  email: account.email,
                  time: formatTime(account.lastSyncedAt),
                },
              )}
            </span>
          </div>
        </div>
        <span className="ssp-status-tag" data-status={account.status}>
          {t(isAuth ? "topbar.popTagAuthExpired" : "topbar.popTagError")}
        </span>
      </div>

      <div className="ssp-reason-box" data-status={account.status}>
        {formatAccountSyncReason(account, lang)}
      </div>

      <div className="ssp-card-actions">
        <span className="ssp-card-hint" data-status={account.status}>
          {t(isAuth ? "topbar.popAuthExpiredHint" : "topbar.popAutoRetryHint")}
        </span>
        <div className="ssp-btn-group">
          <button
            type="button"
            className="ssp-btn-secondary"
            onClick={() => {
              onClosePopover();
              workspace.setOverlay(
                resolveAccountActionOverlay(account, "diagnostics"),
              );
            }}
          >
            {t("topbar.popRunDiagnostics")}
          </button>
          <button
            type="button"
            className="ssp-btn-primary"
            data-status={account.status}
            onClick={() => {
              if (isAuth) {
                onClosePopover();
                workspace.setOverlay(
                  resolveAccountActionOverlay(account, "reauth"),
                );
              } else {
                triggerSyncAccount(account.id);
              }
            }}
          >
            {t(isAuth ? "topbar.popReauthorize" : "topbar.popRetryNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
