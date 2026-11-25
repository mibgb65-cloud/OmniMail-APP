import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function StatusBanner() {
  const { workspace, toastStore, triggerSyncAll } = useApp();
  const { t } = useI18n();
  const { bannerMode, settings, accounts } = workspace;
  const autoReplyAcc = accounts.find(
    (a) => a.id === settings.autoReply.accountId,
  );

  const autoReplyActive =
    settings.autoReply.enabled || bannerMode === "auto-reply";

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

  // 局部账户同步受阻与授权失效已统一收敛至 TopBarSyncChip + SyncStatusPopover + 侧边栏单账号原位提示，不再渲染通栏条推挤工作区
  if (!autoReplyActive) return null;

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
