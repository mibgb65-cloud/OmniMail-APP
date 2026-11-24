import { useI18n } from "../../../i18n";
import { composeApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import { isWailsDesktop } from "../../../state/storageHelpers";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function ReaderOutboxBanners({ mail }: { mail: MailItem }) {
  const { t, formatTime } = useI18n();
  const { workspace, mailStore, composeStore, toastStore } = useApp();

  return (
    <>
      {mail.folder === "drafts" && (
        <div className="security-banner warning" role="status">
          <div className="row" style={{ gap: 8 }}>
            <Icon name="edit" size={16} />
            <span>{t("reader.draftBannerText")}</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => composeStore.openSavedDraft(mail.id)}
          >
            {t("reader.continueEditDraft")}
          </button>
        </div>
      )}

      {mail.folder === "scheduled" && (
        <div className="security-banner warning" role="status">
          <div className="row" style={{ gap: 8 }}>
            <Icon name="clock" size={16} />
            <span>
              {t("reader.scheduledBannerText")}
              {mail.scheduledAt
                ? t("reader.scheduledBannerTime", {
                    time: formatTime(mail.scheduledAt),
                  })
                : ""}
            </span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                void composeApi
                  .retryOutboxJob(mail.id)
                  .then(() => {
                    void mailStore.reloadMessages();
                    toastStore.pushToast({
                      tone: "info",
                      title: t("toasts.skippedScheduleSentNow"),
                    });
                  })
                  .catch((err) =>
                    toastStore.pushToast({
                      tone: "danger",
                      title: t("toasts.sendNowFailed"),
                      detail: parseBackendError(err).message,
                    }),
                  );
              }}
            >
              {t("reader.sendImmediately")}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                void composeApi
                  .cancelOutboxJob(mail.id)
                  .then(() => {
                    void mailStore.reloadMessages();
                    toastStore.pushToast({
                      tone: "info",
                      title: t("toasts.cancelledScheduleRestored"),
                    });
                  })
                  .catch((err) =>
                    toastStore.pushToast({
                      tone: "danger",
                      title: t("toasts.cancelScheduleFailed"),
                      detail: parseBackendError(err).message,
                    }),
                  );
              }}
            >
              {t("reader.cancelSchedule")}
            </button>
          </div>
        </div>
      )}

      {mail.outboxError && (
        <div className="security-banner danger" role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="alertCircle" size={16} />
            <span>
              <strong>{t("reader.outboxErrorPrefix")}</strong>
              {mail.outboxError}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (!isWailsDesktop()) {
                  mailStore.moveMails([mail.id], "sent", {
                    outboxError: undefined,
                    statusBadge: undefined,
                  });
                  return;
                }
                void composeApi
                  .retryOutboxJob(mail.id)
                  .then(() => {
                    void mailStore.reloadMessages();
                    toastStore.pushToast({
                      tone: "info",
                      title: t("toasts.requeuedOutboxRetry"),
                    });
                  })
                  .catch((err) =>
                    toastStore.pushToast({
                      tone: "danger",
                      title: t("toasts.retrySendFailed"),
                      detail: parseBackendError(err).message,
                    }),
                  );
              }}
            >
              {t("reader.retrySendNow")}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() =>
                workspace.setOverlay({
                  type: "diagnostics",
                  accountId: mail.accountId,
                })
              }
            >
              {t("reader.connDiagnostics")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
