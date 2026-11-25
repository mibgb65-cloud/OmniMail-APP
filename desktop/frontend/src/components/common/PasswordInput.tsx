import { useState, type CSSProperties } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

interface PasswordInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  disabled?: boolean;
  maxLength?: number;
  badgeText?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  style,
  ariaLabel,
  disabled = false,
  maxLength,
  badgeText,
}: PasswordInputProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible
    ? t("common.hidePlaintext")
    : t("common.showPlaintext");

  const eyeBtn = (
    <Tooltip label={toggleLabel} placement="top">
      <button
        type="button"
        className="password-eye-btn"
        aria-label={toggleLabel}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={14} />
      </button>
    </Tooltip>
  );

  return (
    <div
      className={`password-field-wrap${badgeText ? " pcm-password-wrap" : ""}`}
      style={style}
    >
      <input
        type={visible ? "text" : "password"}
        className={`input${badgeText ? " has-adornment" : ""}`}
        style={{ fontFamily: "var(--font-mono)" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={maxLength}
      />
      {badgeText ? (
        <div className="pcm-password-actions">
          <span className="pcm-encrypted-pill">{badgeText}</span>
          {eyeBtn}
        </div>
      ) : (
        eyeBtn
      )}
    </div>
  );
}
