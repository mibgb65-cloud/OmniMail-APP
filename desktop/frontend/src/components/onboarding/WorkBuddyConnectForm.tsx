import { useI18n } from "../../i18n";
import type { ParsedBackendError } from "../../services/backendClient";
import {
  deriveConnectModalState,
  type WorkBuddyAuthStage,
  type WorkBuddyMailboxStatus,
} from "../../types/workbuddy";
import { Icon } from "../common/Icon";
import { ProviderConnectInfoBanner } from "./ProviderConnectShell";

export interface WorkBuddyConnectFormProps {
  stage: WorkBuddyAuthStage;
  mailboxStatus: WorkBuddyMailboxStatus;
  detectedEmail: string;
  accountName: string;
  startingAuth: boolean;
  busy: boolean;
  error: ParsedBackendError | null;
  onAccountNameChange: (val: string) => void;
  onStartAuth: () => void;
  onCancelAuth: () => void;
}

export function WorkBuddyConnectForm({
  stage,
  mailboxStatus,
  detectedEmail,
  accountName,
  startingAuth,
  busy,
  error,
  onAccountNameChange,
  onStartAuth,
  onCancelAuth,
}: WorkBuddyConnectFormProps) {
  const { t } = useI18n();
  const { isPolling, isAuthorized, isNotBound } = deriveConnectModalState({
    stage,
    detectedEmail,
    busy,
  });

  const stageLabel = isAuthorized
    ? t("workbuddy.authStageAuthorized")
    : isPolling
      ? t("workbuddy.authStagePolling")
      : isNotBound
        ? t("workbuddy.authStageNotBound")
        : t("workbuddy.authStageIdle");

  const pillClass = isAuthorized
    ? "wb-stage-pill is-authorized"
    : isPolling
      ? "wb-stage-pill is-polling"
      : isNotBound
        ? "wb-stage-pill is-not-bound"
        : "wb-stage-pill";

  const cardDesc = isAuthorized
    ? t("workbuddy.authCardDescAuthorized")
    : isPolling
      ? t("workbuddy.authCardDescPolling")
      : t("workbuddy.authCardDescIdle");

  return (
    <div className="pcm-form-col">
      <div className="pcm-field">
        <label className="pcm-label">{t("workbuddy.authFieldLabel")}</label>
        <div className="muse-login-card wb-auth-card">
          <div className="muse-login-meta">
            <div className="muse-login-title-row">
              <strong className="muse-login-title">
                {t("workbuddy.authCardTitle")}
              </strong>
              <span className={pillClass}>{stageLabel}</span>
            </div>
            <div className="muse-login-desc">{cardDesc}</div>
          </div>

          <div className="wb-auth-actions">
            {isPolling ? (
              <button
                type="button"
                className="btn btn-secondary muse-open-login-btn"
                disabled={busy}
                onClick={onCancelAuth}
              >
                <Icon name="x" size={14} />
                <span>{t("workbuddy.cancelAuthBtn")}</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary muse-open-login-btn"
                disabled={startingAuth || busy}
                onClick={onStartAuth}
              >
                <Icon name="external" size={14} />
                <span>
                  {isAuthorized || isNotBound
                    ? t("workbuddy.reauthorizeBtn")
                    : t("workbuddy.startAuthBtn")}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isNotBound && (
        <div className="pcm-info-banner" role="status">
          <span className="pcm-info-icon" aria-hidden="true">
            <Icon name="info" size={16} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="pcm-info-title">{t("workbuddy.notBoundTitle")}</div>
            <div className="pcm-info-desc">
              {mailboxStatus !== "not_bound" && mailboxStatus !== "deactivated"
                ? t("workbuddy.statusSuspendedHint", { status: mailboxStatus })
                : t("workbuddy.notBoundDesc")}
            </div>
          </div>
        </div>
      )}

      <div className="pcm-field">
        <label className="pcm-label">{t("workbuddy.detectedEmailLabel")}</label>
        <div
          className={`muse-readonly-field ${isAuthorized ? "is-verified" : ""}`}
        >
          <span
            className={`truncate ${isAuthorized ? "muse-verified-addr" : "text-muted"}`}
          >
            {detectedEmail || t("workbuddy.detectedEmailPlaceholder")}
          </span>
          {isAuthorized && (
            <span className="pcm-summary-pill muse-verified-pill">
              {t("workbuddy.authVerifiedPill")}
            </span>
          )}
        </div>
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{t("workbuddy.accountNameLabel")}</label>
        <input
          className="input"
          value={accountName}
          disabled={busy}
          onChange={(e) => onAccountNameChange(e.target.value)}
          placeholder={t("workbuddy.accountNamePlaceholder")}
        />
      </div>

      <div className="pcm-field">
        <label className="pcm-label">
          {t("workbuddy.connectionModeLabel")}
        </label>
        <div className="muse-readonly-field">
          <span className="truncate">{t("workbuddy.connectionModeValue")}</span>
        </div>
      </div>

      {error ? (
        <div className="muse-inline-error" role="alert">
          <Icon name="alertCircle" size={16} />
          <div style={{ minWidth: 0 }}>
            <div className="muse-inline-error-msg">{error.message}</div>
            {error.code && (
              <div className="muse-inline-error-code">
                {t("workbuddy.errorCodeLabel", { code: error.code })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <ProviderConnectInfoBanner
          title={t("workbuddy.infoBannerTitle")}
          description={
            isAuthorized
              ? t("workbuddy.infoBannerReadyDesc", { email: detectedEmail })
              : mailboxStatus === "deactivated"
                ? t("workbuddy.statusDeactivatedHint")
                : t("workbuddy.infoBannerDesc")
          }
        />
      )}
    </div>
  );
}
