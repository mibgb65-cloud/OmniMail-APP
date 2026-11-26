import { useI18n } from "../../i18n";
import type { ProviderId } from "../../types/account";
import {
  ACCOUNT_NAME_MAX_LEN,
  buildAccountNameSuggestions,
  resolveConciseProviderLabel,
} from "../../utils/accountDisplay";
import { ProviderIcon } from "../common/ProviderIcon";

export function AccountDisplayNameField({
  provider,
  email,
  value,
  onChange,
}: {
  provider: ProviderId;
  email: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { lang, t } = useI18n();
  const defaultName = resolveConciseProviderLabel(provider, email, lang);
  const suggestions = buildAccountNameSuggestions(provider, email, lang);

  return (
    <div className="pcm-field">
      <div className="pcm-label-row">
        <label className="pcm-label">{t("onboarding.accountNameLabel")}</label>
        <span className="pcm-label-hint truncate">
          {t("onboarding.accountNameDefaultHint", { defaultName })}
        </span>
      </div>

      <div className="pcm-name-input-wrap">
        <input
          className="input pcm-name-input"
          maxLength={ACCOUNT_NAME_MAX_LEN}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.slice(0, ACCOUNT_NAME_MAX_LEN))
          }
          placeholder={defaultName || t("onboarding.accountNamePlaceholder")}
        />
        <span className="pcm-char-counter">
          {value.length} / {ACCOUNT_NAME_MAX_LEN}
        </span>
      </div>

      <div className="pcm-quick-chips-row">
        <span className="pcm-quick-chips-label">
          {t("onboarding.quickNameLabel")}
        </span>
        <div className="pcm-quick-chips">
          {suggestions.map((chip) => {
            const active = value.trim() === chip;
            return (
              <button
                key={chip}
                type="button"
                className={`pcm-quick-chip ${active ? "is-active" : ""}`}
                onClick={() => onChange(chip)}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MxDetectedBanner({
  mxHost,
  providerLabel,
}: {
  mxHost: string;
  providerLabel: string;
}) {
  const { t } = useI18n();
  if (!mxHost) return null;
  return (
    <span className="pcm-mx-pill">
      <span className="pcm-mx-dot" aria-hidden="true" />
      <span className="truncate">
        {t("onboarding.mxDetectedPill", {
          mxHost,
          provider: providerLabel,
        })}
      </span>
    </span>
  );
}

export function SidebarLivePreviewCard({
  provider,
  displayName,
  email,
  placeholderEmail = "name@your-company.com",
}: {
  provider: ProviderId;
  displayName: string;
  email: string;
  placeholderEmail?: string;
}) {
  const { lang, t } = useI18n();
  const title =
    displayName.trim() || resolveConciseProviderLabel(provider, email, lang);
  const subEmail = email.trim() || placeholderEmail;

  return (
    <div className="pcm-preview-card">
      <div className="pcm-preview-heading">
        {t("onboarding.sidebarPreviewTitle")}
      </div>
      <div className="pcm-preview-row">
        <div className="pcm-preview-row-left">
          <ProviderIcon provider={provider} size={28} />
          <div className="account-row-meta">
            <span className="account-row-name truncate">{title}</span>
            <span className="account-row-sub truncate">{subEmail}</span>
          </div>
        </div>
        <div className="account-row-stats">
          <span className="account-status-line">
            <span
              className="account-status-dot"
              data-status="connected"
              aria-hidden="true"
            />
          </span>
          <span className="account-unread-count">0</span>
        </div>
      </div>
      <p className="pcm-preview-footnote">
        {t("onboarding.sidebarPreviewHint")}
      </p>
    </div>
  );
}
