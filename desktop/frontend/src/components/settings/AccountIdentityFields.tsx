import { useI18n } from "../../i18n";
import type { EmailAccount } from "../../types/account";
import { ACCOUNT_NAME_MAX_LEN } from "../../utils/accountDisplay";
import { FadeTextarea } from "../common/scroll-fade/FadeTextarea";

export function AccountIdentityFields({
  detail,
  conciseFallback,
  displayName,
  senderName,
  replyTo,
  signature,
  onDisplayNameChange,
  onSenderNameChange,
  onReplyToChange,
  onSignatureChange,
}: {
  detail: EmailAccount;
  conciseFallback: string;
  displayName: string;
  senderName: string;
  replyTo: string;
  signature: string;
  onDisplayNameChange: (next: string) => void;
  onSenderNameChange: (next: string) => void;
  onReplyToChange: (next: string) => void;
  onSignatureChange: (next: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="adv-identity-grid">
        <label className="text-xs text-muted">
          <span>{t("settings.accountDisplayNameLabel")}</span>
          <input
            className="input"
            style={{ marginTop: 4 }}
            maxLength={ACCOUNT_NAME_MAX_LEN}
            value={displayName}
            onChange={(e) =>
              onDisplayNameChange(e.target.value.slice(0, ACCOUNT_NAME_MAX_LEN))
            }
            placeholder={conciseFallback}
          />
          <span className="adv-field-hint">
            {t("settings.accountDisplayNameHint")}
          </span>
        </label>
        <label className="text-xs text-muted">
          <span>{t("settings.senderDisplayName")}</span>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={senderName}
            onChange={(e) => onSenderNameChange(e.target.value)}
          />
          <span className="adv-field-hint">
            {t("settings.senderDisplayNameHint")}
          </span>
        </label>
        <label className="text-xs text-muted">
          <span>{t("settings.defaultReplyTo")}</span>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={replyTo}
            onChange={(e) => onReplyToChange(e.target.value)}
            placeholder={detail.email}
          />
          <span className="adv-field-hint">
            {t("settings.defaultReplyToHint")}
          </span>
        </label>
      </div>

      <label className="text-xs text-muted" htmlFor="account-signature">
        {t("settings.signatureTemplate")}
        <FadeTextarea
          id="account-signature"
          className="textarea"
          rows={3}
          style={{ marginTop: 4 }}
          value={signature}
          onChange={(e) => onSignatureChange(e.target.value)}
        />
      </label>
    </>
  );
}
