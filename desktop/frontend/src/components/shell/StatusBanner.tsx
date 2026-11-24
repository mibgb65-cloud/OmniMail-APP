import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function StatusBanner() {
  const { workspace, toastStore, triggerSyncAll } = useApp();
  const { t } = useI18n();
  const { bannerMode, settings, accounts } = workspace;
  const expiredAcc =
    accounts.find((a) => a.status === "auth-expired") ?? accounts[0];
  const failedAcc = accounts.find((a) => a.status === "error") ?? accounts[0];
  const autoReplyAcc = accounts.find(
    (a) => a.id === settings.autoReply.accountId,
  );

  const autoReplyActive =
    settings.autoReply.enabled || bannerMode === "auto-reply";

  if (bannerMode === "none" && !autoReplyActive) return null;

  if (bannerMode === "offline") {
    return (
      <div className="runtime-banner warning" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="wifiOff" size={16} />
          <strong>{t("topbar.offlineBannerTitle")}</strong>
          <span style={{ opacity: 0.85 }}>{t("topbar.offlineBannerDesc")}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              workspace.setBannerMode("none");
              triggerSyncAll();
            }}
          >
            {t("topbar.reconnectNow")}
          </button>
        </div>
      </div>
    );
  }

  if (bannerMode === "auth-expired") {
    return (
      <div className="runtime-banner danger" role="alert">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alertCircle" size={16} />
          <strong>
            {t("topbar.authExpiredTitle", {
              name: expiredAcc?.name ?? t("topbar.accountFallback"),
            })}
          </strong>
          <span style={{ opacity: 0.85 }}>{t("topbar.authExpiredDesc")}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() =>
              expiredAcc && expiredAcc.authMode !== "oauth"
                ? workspace.setOverlay({
                    type: "account-server",
                    accountId: expiredAcc.id,
                  })
                : workspace.setOverlay({
                    type: "oauth-flow",
                    provider: expiredAcc?.provider ?? "gmail",
                    stage: "waiting",
                  })
            }
          >
            {t("topbar.reauthorize")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => workspace.setBannerMode("none")}
          >
            {t("topbar.handleLater")}
          </button>
        </div>
      </div>
    );
  }

  if (bannerMode === "partial-sync") {
    return (
      <div className="runtime-banner warning" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alertCircle" size={16} />
          <strong>
            {t("topbar.partialSyncTitle", {
              name: failedAcc?.name ?? t("topbar.accountFallback"),
            })}
          </strong>
          <span style={{ opacity: 0.85 }}>{t("topbar.partialSyncDesc")}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              workspace.setOverlay({
                type: "diagnostics",
                accountId: failedAcc?.id ?? "",
              })
            }
          >
            {t("topbar.runDiagnostics")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => workspace.setBannerMode("none")}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="runtime-banner info" role="status">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Icon name="autoReply" size={16} />
        <strong>
          {t("topbar.autoReplyActiveTitle", {
            account: autoReplyAcc?.name ?? t("topbar.autoReplyDefaultAccount"),
          })}
        </strong>
        <span style={{ opacity: 0.88 }}>
          {t("topbar.autoReplyActiveDetail", {
            start: settings.autoReply.startTime,
            end: settings.autoReply.endTime,
            count: settings.autoReply.repliedCount,
          })}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() =>
            workspace.setOverlay({ type: "settings", tab: "auto-reply" })
          }
        >
          {t("topbar.adjustReplyContent")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger-soft"
          onClick={() => {
            workspace.updateSettings({
              autoReply: { ...settings.autoReply, enabled: false },
            });
            workspace.setBannerMode("none");
            toastStore.pushToast({
              tone: "info",
              title: t("toasts.autoReplyDisabled"),
            });
          }}
        >
          {t("topbar.disableAutoReplyNow")}
        </button>
      </div>
    </div>
  );
}
