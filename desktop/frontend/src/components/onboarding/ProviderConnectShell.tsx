import type { ReactNode } from "react";
import { useI18n } from "../../i18n";
import type { ProviderId } from "../../types/account";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import {
  resolveAccountName,
  resolveSecretLabelKey,
} from "./providerConnectHelpers";

export { resolveAccountName, resolveSecretLabelKey };

export function ProviderSummaryCard({
  provider,
  name,
  domainHint,
  mode = "tls",
}: {
  provider: ProviderId;
  name: string;
  domainHint: string;
  mode?: "tls" | "oauth";
}) {
  const { t } = useI18n();

  return (
    <div className="pcm-summary-card">
      <div className="pcm-summary-left">
        <span className="pcm-summary-badge">
          <ProviderIcon provider={provider} size={25} bare />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="pcm-summary-name">{name}</div>
          <div className="pcm-summary-domain truncate">{domainHint}</div>
        </div>
      </div>

      <span className="pcm-summary-pill">
        <span className="pcm-summary-dot" aria-hidden="true" />
        <span>
          {t(
            mode === "oauth"
              ? "onboarding.summaryOAuthPill"
              : "onboarding.summaryTlsPill",
          )}
        </span>
      </span>
    </div>
  );
}

export function ProviderConnectInfoBanner({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="pcm-info-banner">
      <span className="pcm-info-icon" aria-hidden="true">
        <Icon name="info" size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="pcm-info-title">
          {title ?? t("onboarding.infoBannerTitle")}
        </div>
        <div className="pcm-info-desc">
          {description ?? t("onboarding.infoBannerDesc")}
        </div>
      </div>
    </div>
  );
}

export function ProviderConnectShell({
  heading,
  badgeText,
  subtitle,
  onClose,
  onBack,
  backDisabled = false,
  footerNote,
  primaryAction,
  children,
}: {
  heading: string;
  badgeText?: string;
  subtitle?: string;
  onClose: () => void;
  onBack: () => void;
  backDisabled?: boolean;
  footerNote?: string;
  primaryAction: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <ModalShell
      maxWidth={980}
      noPadding
      ariaLabel={heading}
      cardClassName="pcm-modal-card"
      onClose={onClose}
      footer={
        <>
          <span className="pcm-footer-note">
            {footerNote ?? t("onboarding.footerSafetyNote")}
          </span>
          <div className="pcm-footer-actions">
            <button
              type="button"
              className="btn pcm-btn-back"
              disabled={backDisabled}
              onClick={onBack}
            >
              <Icon name="arrowLeft" size={14} />
              <span>{t("onboarding.backToSourceBtn")}</span>
            </button>
            {primaryAction}
          </div>
        </>
      }
    >
      <div className="pcm-header">
        <div style={{ minWidth: 0 }}>
          <div className="pcm-title-row">
            <h2 className="pcm-title">{heading}</h2>
            <span className="pcm-existing-pill">
              {badgeText ?? t("onboarding.connectBadgeExisting")}
            </span>
          </div>
          <p className="pcm-subtitle">
            {subtitle ?? t("onboarding.connectSubtitleUnified")}
          </p>
        </div>

        <Tooltip label={t("common.closeModal")} shortcut="Esc">
          <button
            type="button"
            className="icon-btn pcm-close-btn"
            onClick={onClose}
            aria-label={t("common.closeModal")}
          >
            <Icon name="x" size={15} />
          </button>
        </Tooltip>
      </div>

      <FadeScroll
        className="pcm-body"
        label={t("common.modalBodyNamed", { heading })}
      >
        {children}
      </FadeScroll>
    </ModalShell>
  );
}
