import { useI18n } from "../../i18n";
import type { ParsedBackendError } from "../../services/backendClient";
import type { MuseLoginStage } from "../../types/muse";
import { Icon } from "../common/Icon";
import { ProviderConnectInfoBanner } from "./ProviderConnectShell";

export interface MuseConnectFormProps {
  loginStage: MuseLoginStage;
  verifiedEmail: string;
  accountName: string;
  openingLogin: boolean;
  busy: boolean;
  error: ParsedBackendError | null;
  onAccountNameChange: (val: string) => void;
  onOpenLoginWindow: () => void;
}

export function MuseConnectForm({
  loginStage,
  verifiedEmail,
  accountName,
  openingLogin,
  busy,
  error,
  onAccountNameChange,
  onOpenLoginWindow,
}: MuseConnectFormProps) {
  const { t } = useI18n();
  const isVerified = Boolean(verifiedEmail);
  const stageText = isVerified
    ? t("muse.loginStageDone")
    : loginStage === "login_open"
      ? t("muse.loginStageOpen")
      : t("muse.loginStageIdle");

  const stageClass = isVerified
    ? "muse-stage-pill is-done"
    : loginStage === "login_open"
      ? "muse-stage-pill is-open"
      : "muse-stage-pill";

  return (
    <div className="pcm-form-col">
      <div className="pcm-field">
        <label className="pcm-label">{t("muse.webLoginFieldLabel")}</label>
        <div className="muse-login-card">
          <div className="muse-login-meta">
            <div className="muse-login-title-row">
              <strong className="muse-login-title">
                {t("muse.loginCardTitle")}
              </strong>
              <span className={stageClass}>{stageText}</span>
            </div>
            <div className="muse-login-desc">{t("muse.loginCardDesc")}</div>
          </div>

          <button
            type="button"
            className="btn btn-secondary muse-open-login-btn"
            disabled={openingLogin || busy}
            onClick={onOpenLoginWindow}
          >
            <Icon name="external" size={14} />
            <span>
              {loginStage === "login_open" || isVerified
                ? t("muse.reopenLoginWindowBtn")
                : t("muse.openLoginWindowBtn")}
            </span>
          </button>
        </div>
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{t("muse.verifiedEmailLabel")}</label>
        <div
          className={`muse-readonly-field ${isVerified ? "is-verified" : ""}`}
        >
          <span
            className={`truncate ${isVerified ? "muse-verified-addr" : "text-muted"}`}
          >
            {verifiedEmail || t("muse.verifiedEmailPlaceholder")}
          </span>
          {isVerified && (
            <span className="pcm-summary-pill muse-verified-pill">
              {t("muse.sessionVerifiedPill")}
            </span>
          )}
        </div>
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{t("muse.accountNameLabel")}</label>
        <input
          className="input"
          value={accountName}
          disabled={busy}
          onChange={(e) => onAccountNameChange(e.target.value)}
          placeholder={t("muse.accountNamePlaceholder")}
        />
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{t("muse.connectionModeLabel")}</label>
        <div className="muse-readonly-field">
          <span className="truncate">{t("muse.connectionModeValue")}</span>
        </div>
      </div>

      {error ? (
        <div className="muse-inline-error" role="alert">
          <Icon name="alertCircle" size={16} />
          <div style={{ minWidth: 0 }}>
            <div className="muse-inline-error-msg">{error.message}</div>
            {error.code && (
              <div className="muse-inline-error-code">
                {t("muse.errorCodeLabel", { code: error.code })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <ProviderConnectInfoBanner
          title={t("muse.infoBannerTitle")}
          description={
            isVerified
              ? t("muse.verifiedReadyHint", { email: verifiedEmail })
              : t("muse.infoBannerDesc")
          }
        />
      )}
    </div>
  );
}
