import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import { ProviderConnectInfoBanner } from "./ProviderConnectShell";

export function OAuthStatusColumn({
  stage,
  authUrl,
  errorMsg,
  onCopyLink,
  onSwitchAppPassword,
}: {
  stage: "waiting" | "incomplete";
  authUrl: string;
  errorMsg: string;
  onCopyLink: () => void;
  onSwitchAppPassword: () => void;
}) {
  const { t } = useI18n();
  const waiting = stage === "waiting";

  return (
    <div className="pcm-form-col">
      <div className="pcm-oauth-box" role="status" aria-live="polite">
        <div className="row-between" style={{ gap: 10 }}>
          <div
            style={{ fontSize: 15, fontWeight: 700, color: "var(--text-ink)" }}
          >
            {waiting
              ? t("onboarding.oauthWaitingTitle")
              : t("onboarding.oauthFailedTitle")}
          </div>
          <span
            className={`pill ${waiting ? "pill-accent" : "pill-warning"}`}
            style={{ flexShrink: 0 }}
          >
            <Icon name={waiting ? "external" : "alertCircle"} size={13} />
            <span>
              {waiting
                ? t("onboarding.oauthCallbackListening")
                : t("onboarding.oauthWaitingManual")}
            </span>
          </span>
        </div>

        <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
          {errorMsg || t("onboarding.oauthDefaultHint")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="pcm-oauth-row">
            <span>{t("onboarding.oauthStepBrowserLabel")}</span>
            <span className="pill pill-accent">
              {t("onboarding.oauthStatusReady")}
            </span>
          </div>
          <div className="pcm-oauth-row">
            <span>{t("onboarding.oauthStepConsentLabel")}</span>
            <span
              className={`pill ${waiting ? "pill-neutral" : "pill-warning"}`}
            >
              {waiting
                ? t("onboarding.oauthStatusPending")
                : t("onboarding.oauthWaitingManual")}
            </span>
          </div>
          <div className="pcm-oauth-row">
            <span>{t("onboarding.oauthStepCallbackLabel")}</span>
            <span className="pill pill-neutral">
              {t("onboarding.localEncryptedPill")}
            </span>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn pcm-btn-back"
            onClick={onSwitchAppPassword}
          >
            <Icon name="lock" size={14} />
            <span>{t("onboarding.use16CharAppPwd")}</span>
          </button>
          {authUrl && (
            <button
              type="button"
              className="btn pcm-btn-back"
              onClick={onCopyLink}
            >
              <Icon name="copy" size={13} />
              <span>{t("onboarding.copyAuthLinkBtn")}</span>
            </button>
          )}
        </div>
      </div>

      <ProviderConnectInfoBanner
        title={t("onboarding.oauthBrowserCardTitle")}
        description={t("onboarding.oauthFallbackHint")}
      />
    </div>
  );
}
