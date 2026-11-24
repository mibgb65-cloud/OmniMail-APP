import { useState } from "react";
import { localizeSecurityWarning, useI18n } from "../../../i18n";
import { mailApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import { ReaderOutboxBanners } from "./ReaderOutboxBanners";
import {
  authStatusPillClass,
  formatAuthBadgeValue,
  isTrustedSecuritySender,
  rememberTrustedSecuritySender,
} from "./securityBannerPolicy";

export function ReaderSecurityBanners({ mail }: { mail: MailItem }) {
  const { lang, t, formatTime } = useI18n();
  const { workspace, mailStore, toastStore } = useApp();
  const [, setTrustTick] = useState(0);
  const warning = mail.securityWarning;
  const localizedWarning = warning
    ? localizeSecurityWarning(warning, lang)
    : null;
  const isDanger = warning?.level === "danger";
  const trusted = Boolean(
    warning &&
    isTrustedSecuritySender(
      workspace.activeProfileId,
      mail.senderEmail,
      mail.id,
    ),
  );
  const showSecurityBanner = Boolean(warning && localizedWarning && !trusted);
  const showRemoteImageBanner =
    workspace.settings.blockRemoteImages &&
    mail.hasRemoteImages &&
    !mail.remoteImagesAllowed &&
    warning?.level !== "danger";

  const authBadges = warning
    ? [
        { name: "SPF", value: warning.spf },
        { name: "DKIM", value: warning.dkim },
        { name: "DMARC", value: warning.dmarc },
      ]
    : [];

  return (
    <>
      <ReaderOutboxBanners mail={mail} />

      {showSecurityBanner && localizedWarning && (
        <div
          className={`phishing-banner ${isDanger ? "danger" : "warning"}`}
          role={isDanger ? "alert" : "status"}
        >
          <div className="phishing-banner-header">
            <div className="phishing-banner-title">
              <Icon name="shieldWarning" size={18} />
              <strong>{localizedWarning.title}</strong>
            </div>
            <div
              className="phishing-auth-pills"
              aria-label={t("security.authPillsAria")}
            >
              {authBadges.map(({ name, value }) => (
                <span
                  key={name}
                  className={`pill phishing-auth-pill ${authStatusPillClass(value)}`}
                >
                  {name}: {formatAuthBadgeValue(value)}
                </span>
              ))}
            </div>
          </div>

          <p className="phishing-banner-detail">{localizedWarning.detail}</p>

          <div className="phishing-banner-actions">
            <div className="phishing-banner-btn-group">
              <button
                type="button"
                className={`btn btn-sm ${isDanger ? "btn-danger" : "btn-secondary"}`}
                onClick={() => {
                  mailStore.moveMails([mail.id], "spam");
                  toastStore.pushToast({
                    tone: "info",
                    title: t("toasts.movedPhishingToSpam"),
                  });
                }}
              >
                {t("security.moveToSpam")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  workspace.addBlacklist({
                    target: mail.senderEmail,
                    kind: "address",
                    reason: t(
                      isDanger
                        ? "security.blacklistReasonDanger"
                        : "security.blacklistReasonWarning",
                    ),
                    blockedCount: 0,
                    addedAt: formatTime("今天"),
                  });
                  mailStore.moveMails([mail.id], "spam");
                  toastStore.pushToast({
                    tone: "warning",
                    title: t("toasts.blacklistedAndSpam", {
                      email: mail.senderEmail,
                    }),
                  });
                }}
              >
                {t("security.blockSender")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  workspace.setOverlay({ type: "mail-source", mailId: mail.id })
                }
              >
                {t("security.viewRawHeaders")}
              </button>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-ghost phishing-trust-btn"
              onClick={() => {
                rememberTrustedSecuritySender(
                  workspace.activeProfileId,
                  mail.senderEmail,
                  mail.id,
                );
                setTrustTick((n) => n + 1);
                toastStore.pushToast({
                  tone: "info",
                  title: mail.senderEmail
                    ? t("toasts.trustedSenderSession", {
                        email: mail.senderEmail,
                      })
                    : t("toasts.dismissedSecurityBanner"),
                });
              }}
            >
              {t("security.trustSender")}
            </button>
          </div>
        </div>
      )}

      {showRemoteImageBanner && (
        <div className="security-banner warning" role="status">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="image" size={16} />
            <span>
              <strong>{t("security.remoteImagesBlockedTitle")}</strong> ·{" "}
              {t("security.remoteImagesBlockedDesc")}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              void mailApi
                .allowRemoteImages(mail.id)
                .then((restoredHtml) => {
                  mailStore.updateMail(mail.id, {
                    remoteImagesAllowed: true,
                    messages: mail.messages.map((msg) =>
                      msg.id === mail.id && restoredHtml
                        ? { ...msg, bodyHtml: restoredHtml }
                        : msg,
                    ),
                  });
                  toastStore.pushToast({
                    tone: "info",
                    title: t("toasts.allowedRemoteImages"),
                  });
                })
                .catch((err) =>
                  toastStore.pushToast({
                    tone: "danger",
                    title: t("toasts.loadRemoteImagesFailed"),
                    detail: parseBackendError(err).message,
                  }),
                );
            }}
          >
            {t("security.showRemoteImagesBtn")}
          </button>
        </div>
      )}
    </>
  );
}
