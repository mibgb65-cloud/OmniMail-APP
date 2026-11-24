import { useState } from "react";
import { SendTestNotification } from "../../../bindings/omnimail/desktopservice";
import { useI18n } from "../../i18n";
import { parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function DesktopExtrasModal({ tab }: { tab: "tray" | "notifications" }) {
  const { workspace, composeStore, triggerSyncAll } = useApp();
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  }>();
  const totalUnread = workspace.accounts.reduce(
    (sum, a) => sum + a.unreadCount,
    0,
  );

  async function sendTestNotification() {
    if (!isWailsDesktop()) {
      setFeedback({
        error: true,
        message: t("overlays.extrasDesktopOnlyHint"),
      });
      return;
    }

    setSending(true);
    setFeedback(undefined);
    try {
      await SendTestNotification();
      setFeedback({
        error: false,
        message: t("overlays.extrasSubmittedHint"),
      });
    } catch (err) {
      setFeedback({
        error: true,
        message: t("overlays.extrasFailedPrefix", {
          error: parseBackendError(err).message,
        }),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalShell
      heading={t("overlays.extrasHeading")}
      subtitle={t("overlays.extrasSubtitle")}
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${tab === "tray" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({ type: "desktop-extras", tab: "tray" })
              }
            >
              {t("overlays.extrasTrayTab")}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "notifications" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.setOverlay({
                  type: "desktop-extras",
                  tab: "notifications",
                })
              }
            >
              {t("overlays.extrasNotificationsTab")}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            {t("common.close")}
          </button>
        </>
      }
    >
      {tab === "tray" ? (
        <div className="settings-card" style={{ gap: 6 }}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <strong style={{ fontSize: 13 }}>
              {t("overlays.extrasTrayCardTitle")}
            </strong>
            <span className="pill pill-success">
              {t("overlays.extrasTrayOnlineBadge", {
                accounts: workspace.accounts.length,
                unread: totalUnread,
              })}
            </span>
          </div>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              workspace.setOverlay({ type: "none" });
              composeStore.openNewCompose();
            }}
          >
            <span className="row">
              <Icon name="pen" size={14} /> {t("overlays.extrasQuickCompose")}
            </span>
            <kbd className="kbd">Ctrl N</kbd>
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              workspace.setOverlay({ type: "none" });
              triggerSyncAll();
            }}
          >
            <span className="row">
              <Icon name="refresh" size={14} /> {t("overlays.extrasSyncAllNow")}
            </span>
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() =>
              workspace.setOverlay({ type: "profile-manage", mode: "switch" })
            }
          >
            <span className="row">
              <Icon name="users" size={14} />{" "}
              {t("overlays.extrasSwitchProfile")}
            </span>
          </button>
        </div>
      ) : (
        <div className="settings-card">
          <div className="row-between">
            <strong style={{ fontSize: 14 }}>
              {t("overlays.extrasInAppNotifyTitle")}
            </strong>
            <span
              className={`pill ${
                workspace.settings.showDesktopNotifications
                  ? "pill-success"
                  : "pill-warning"
              }`}
            >
              {workspace.settings.showDesktopNotifications
                ? t("common.enabled")
                : t("common.disabled")}
            </span>
          </div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
            {t("overlays.extrasInAppNotifyDesc")}
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={sending}
              aria-busy={sending}
              onClick={() => void sendTestNotification()}
            >
              <Icon name="bell" size={14} />
              {sending
                ? t("overlays.extrasSendingBtn")
                : t("overlays.extrasSendTestBtn")}
            </button>
          </div>
          {feedback && (
            <div
              className="text-xs"
              role={feedback.error ? "alert" : "status"}
              style={{
                color: feedback.error
                  ? "var(--status-danger)"
                  : "var(--text-muted)",
              }}
            >
              {feedback.message}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
