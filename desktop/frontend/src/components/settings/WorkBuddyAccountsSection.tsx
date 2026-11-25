import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { ProviderIcon } from "../common/ProviderIcon";

export function WorkBuddyAccountsSection() {
  const { workspace, workBuddyStore } = useApp();
  const { t } = useI18n();

  if (workBuddyStore.accounts.length === 0) {
    return null;
  }

  return (
    <>
      {workBuddyStore.accounts.map((acc) => (
        <div key={acc.accountId} className="settings-card">
          <div className="row-between">
            <div className="row" style={{ gap: 12 }}>
              <ProviderIcon provider="workbuddy" size={30} />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>
                    {acc.accountName || t("workbuddy.providerName")}
                  </strong>
                  <span className="pill pill-accent">
                    {t("workbuddy.addModalCardBadge")}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  {t("workbuddy.settingsCardSub", { email: acc.email })}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  workspace.setOverlay({ type: "none" });
                  workBuddyStore.selectAccount(acc.accountId);
                }}
              >
                {t("workbuddy.openViewBtn")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  void workBuddyStore.disconnectAccount(acc.accountId)
                }
              >
                {t("workbuddy.disconnectBtn")}
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
