import { useState } from "react";
import { useI18n } from "../../i18n";
import type { ConnectionTestReport } from "../../services/backendClient";
import type { ProviderCatalogItem, ProviderId } from "../../types/account";
import type { AsyncActionStatus } from "../common/AsyncActionButton";
import { HandshakeSteps } from "../common/HandshakeSteps";
import { Icon } from "../common/Icon";
import { PasswordInput } from "../common/PasswordInput";
import {
  ProviderConnectInfoBanner,
  resolveSecretLabelKey,
} from "./ProviderConnectShell";

export interface ProviderGuideFormProps {
  provider: ProviderId;
  meta: ProviderCatalogItem;
  email: string;
  accountName: string;
  secret: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  status: AsyncActionStatus;
  report: ConnectionTestReport | null;
  onEmailChange: (next: string) => void;
  onEmailBlur: (next: string) => void;
  onAccountNameChange: (next: string) => void;
  onSecretChange: (next: string) => void;
  onImapHostChange: (next: string) => void;
  onImapPortChange: (next: number) => void;
  onSmtpHostChange: (next: string) => void;
  onSmtpPortChange: (next: number) => void;
  onStepLabelChange: (label: string) => void;
}

export function ProviderGuideForm({
  provider,
  meta,
  email,
  accountName,
  secret,
  imapHost,
  imapPort,
  smtpHost,
  smtpPort,
  status,
  report,
  onEmailChange,
  onEmailBlur,
  onAccountNameChange,
  onSecretChange,
  onImapHostChange,
  onImapPortChange,
  onSmtpHostChange,
  onSmtpPortChange,
  onStepLabelChange,
}: ProviderGuideFormProps) {
  const { t } = useI18n();
  const [serverOpen, setServerOpen] = useState(false);
  const secretLabel = t(resolveSecretLabelKey(provider));
  const showHandshake = status !== "idle" || Boolean(report);

  return (
    <div className="pcm-form-col">
      <div className="pcm-field">
        <label className="pcm-label">{t("onboarding.emailAddressLabel")}</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={(e) => onEmailBlur(e.target.value)}
          placeholder={
            meta.emailPlaceholder || t("onboarding.fullEmailPlaceholder")
          }
        />
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{t("onboarding.accountNameLabel")}</label>
        <input
          className="input"
          value={accountName}
          onChange={(e) => onAccountNameChange(e.target.value)}
          placeholder={t("onboarding.accountNamePlaceholder")}
        />
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{secretLabel}</label>
        <PasswordInput
          value={secret}
          onChange={onSecretChange}
          badgeText={t("onboarding.localEncryptedPill")}
          placeholder={t("onboarding.secretInputPlaceholder")}
          ariaLabel={secretLabel}
        />
      </div>

      <div className="pcm-field">
        <label className="pcm-label">{t("onboarding.serverConfigLabel")}</label>
        <button
          type="button"
          className="pcm-server-toggle"
          aria-expanded={serverOpen}
          data-open={serverOpen ? "true" : "false"}
          onClick={() => setServerOpen((v) => !v)}
        >
          <span className="truncate">
            {t("onboarding.serverConfigToggle", { provider: meta.name })}
          </span>
          <span className="pcm-server-chevron" aria-hidden="true">
            <Icon name="chevronDown" size={15} />
          </span>
        </button>

        {serverOpen && (
          <div className="pcm-server-panel">
            <div className="pcm-field">
              <label className="pcm-label">
                {t("onboarding.imapHostFieldLabel")}
              </label>
              <input
                className="input"
                value={imapHost}
                onChange={(e) => onImapHostChange(e.target.value)}
              />
            </div>
            <div className="pcm-field">
              <label className="pcm-label">
                {t("onboarding.imapPortLabel")}
              </label>
              <input
                className="input"
                inputMode="numeric"
                value={String(imapPort)}
                onChange={(e) =>
                  onImapPortChange(Number(e.target.value.trim()) || 993)
                }
              />
            </div>
            <div className="pcm-field">
              <label className="pcm-label">
                {t("onboarding.smtpHostFieldLabel")}
              </label>
              <input
                className="input"
                value={smtpHost}
                onChange={(e) => onSmtpHostChange(e.target.value)}
              />
            </div>
            <div className="pcm-field">
              <label className="pcm-label">
                {t("onboarding.smtpPortLabel")}
              </label>
              <input
                className="input"
                inputMode="numeric"
                value={String(smtpPort)}
                onChange={(e) =>
                  onSmtpPortChange(Number(e.target.value.trim()) || 465)
                }
              />
            </div>
          </div>
        )}
      </div>

      {showHandshake ? (
        <HandshakeSteps
          running={status === "loading"}
          report={report}
          endpointHint={`${imapHost.trim()}:${imapPort}`}
          onStepLabelChange={onStepLabelChange}
        />
      ) : (
        <ProviderConnectInfoBanner />
      )}
    </div>
  );
}
