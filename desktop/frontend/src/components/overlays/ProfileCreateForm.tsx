import { useI18n } from "../../i18n";
import { PasswordInput } from "../common/PasswordInput";

const PROFILE_COLORS = ["#141E2E", "#2563EB", "#059669", "#7C3AED", "#D97706"];

export interface CreateProfileFormValues {
  name: string;
  badge: string;
  color: string;
  pin: string;
  customDir: string;
}

export function ProfileCreateForm({
  val,
  onChange,
  onPickDir,
}: {
  val: CreateProfileFormValues;
  onChange: (patch: Partial<CreateProfileFormValues>) => void;
  onPickDir: () => void;
}) {
  const { t } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.profNameLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={val.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t("overlays.profNamePlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.profBadgeCharLabel")}
          </label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            maxLength={2}
            value={val.badge}
            onChange={(e) => onChange({ badge: e.target.value })}
            placeholder={
              val.name.slice(0, 1) || t("overlays.profBadgeDefaultChar")
            }
          />
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <span className="text-xs text-muted">
          {t("overlays.profColorLabel")}
        </span>
        {PROFILE_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange({ color: hex })}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: hex,
              border:
                val.color === hex ? "2px solid var(--brand-accent)" : "none",
            }}
            aria-label={t("overlays.profPickColorAria", { hex })}
          />
        ))}
      </div>

      <div>
        <label className="text-xs text-muted">
          {t("overlays.profOptionalPinLabel")}
        </label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={val.pin}
          onChange={(pin) => onChange({ pin })}
          placeholder={t("overlays.profOptionalPinPlaceholder")}
          ariaLabel={t("overlays.profNewPinAria")}
        />
      </div>

      <div>
        <label className="text-xs text-muted">
          {t("overlays.profCustomDirLabel")}
        </label>
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <input
            className="input"
            value={val.customDir}
            onChange={(e) => onChange({ customDir: e.target.value })}
            placeholder={t("overlays.profCustomDirPlaceholder")}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onPickDir}
          >
            {t("common.browse")}
          </button>
        </div>
      </div>
    </div>
  );
}
