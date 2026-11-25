import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { AccountDetailView } from "./AccountDetailView";

export function AccountsTab({
  selectedAccountId,
  onSelectAccount,
}: {
  selectedAccountId?: string;
  onSelectAccount: (id?: string) => void;
}) {
  const { workspace, museStore } = useApp();
  const { t, formatTime } = useI18n();

  if (
    selectedAccountId &&
    workspace.accounts.some((a) => a.id === selectedAccountId)
  ) {
    return (
      <AccountDetailView
        accountId={selectedAccountId}
        onBack={() => onSelectAccount(undefined)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row-between">
        <div>
          <strong style={{ fontSize: 15 }}>
            {t("settings.accountsHeading", {
              count: workspace.accounts.length,
            })}
          </strong>
          <div className="text-xs text-muted">{t("settings.accountsDesc")}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => workspace.setOverlay({ type: "add-account" })}
        >
          <Icon name="plus" size={14} /> {t("settings.addAccountBtn")}
        </button>
      </div>

      {workspace.accounts.map((acc) => (
        <div
          key={acc.id}
          className="settings-card"
          style={{ cursor: "pointer" }}
          onClick={() => onSelectAccount(acc.id)}
        >
          <div className="row-between">
            <div className="row" style={{ gap: 12 }}>
              <ProviderIcon provider={acc.provider} size={30} />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{acc.name}</strong>
                  {workspace.settings.defaultSendAccountId === acc.id && (
                    <span className="pill pill-accent">
                      {t("settings.defaultSendBadge")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {t("settings.accountRowSub", {
                    email: acc.email,
                    lastSynced: formatTime(acc.lastSyncedAt),
                    size: acc.storageMb,
                  })}
                </div>
              </div>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  workspace.setOverlay({
                    type: "diagnostics",
                    accountId: acc.id,
                  });
                }}
              >
                {t("settings.diagnoseBtn")}
              </button>
              <Icon name="chevronRight" size={15} />
            </div>
          </div>
        </div>
      ))}

      {museStore.status.bound && museStore.status.verifiedEmail && (
        <div className="settings-card">
          <div className="row-between">
            <div className="row" style={{ gap: 12 }}>
              <ProviderIcon provider="muse" size={30} />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>
                    {museStore.status.accountName ||
                      t("muse.settingsCardTitle")}
                  </strong>
                  <span className="pill pill-accent">
                    {t("muse.addModalCardBadge")}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  {t("muse.settingsCardSub", {
                    email: museStore.status.verifiedEmail,
                  })}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  workspace.setOverlay({ type: "none" });
                  workspace.setScreen("muse");
                }}
              >
                {t("muse.openViewBtn")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void museStore.disconnect()}
              >
                {t("muse.disconnectBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
