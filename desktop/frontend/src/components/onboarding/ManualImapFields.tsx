import { useI18n } from "../../i18n";
import { CustomSelect } from "../common/CustomSelect";
import { PasswordInput } from "../common/PasswordInput";

export interface ManualImapFormState {
  displayName: string;
  email: string;
  password: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  security: string;
}

export function ManualImapFields({
  val,
  onChange,
  onEmailBlur,
}: {
  val: ManualImapFormState;
  onChange: (patch: Partial<ManualImapFormState>) => void;
  onEmailBlur: (email: string) => void;
}) {
  const { t } = useI18n();
  const securityOptions = [
    {
      value: "SSL/TLS",
      label: "SSL / TLS",
      hint: t("onboarding.secRecommended993"),
    },
    { value: "STARTTLS", label: "STARTTLS", hint: "143/587" },
    {
      value: "NONE",
      label: t("onboarding.secNoneLabel"),
      hint: t("onboarding.secNoneHint"),
    },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.displayNameLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.emailAddressLabel")}
          </label>
          <input
            type="email"
            className="input"
            style={{ marginTop: 4 }}
            value={val.email}
            onChange={(e) => onChange({ email: e.target.value })}
            onBlur={(e) => onEmailBlur(e.target.value)}
            placeholder="name@company.example"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">
          {t("onboarding.appPwdLabel")}
        </label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={val.password}
          onChange={(password) => onChange({ password })}
          placeholder={t("onboarding.appPwdPlaceholder")}
          ariaLabel={t("onboarding.appPwdAria")}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.imapServerLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.imapHost}
            onChange={(e) => onChange({ imapHost: e.target.value })}
            placeholder="imap.company.example"
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.imapPortLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.imapPort}
            onChange={(e) => onChange({ imapPort: e.target.value })}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1.25fr",
          gap: 10,
        }}
      >
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.smtpServerLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.smtpHost}
            onChange={(e) => onChange({ smtpHost: e.target.value })}
            placeholder="smtp.company.example"
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.smtpPortLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.smtpPort}
            onChange={(e) => onChange({ smtpPort: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("onboarding.encryptionModeLabel")}
          </label>
          <CustomSelect
            mono
            fullWidth
            minMenuWidth={216}
            style={{ marginTop: 4 }}
            value={val.security}
            options={securityOptions}
            ariaLabel={t("onboarding.encryptionModeLabel")}
            onChange={(next) =>
              onChange({
                security: next,
                smtpPort:
                  next === "STARTTLS"
                    ? "587"
                    : next === "SSL/TLS"
                      ? "465"
                      : val.smtpPort,
              })
            }
          />
        </div>
      </div>
    </>
  );
}
