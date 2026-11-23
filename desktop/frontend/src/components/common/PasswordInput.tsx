import { useState, type CSSProperties } from "react";
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
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  style,
  ariaLabel,
  disabled = false,
  maxLength,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field-wrap" style={style}>
      <input
        type={visible ? "text" : "password"}
        className="input"
        style={{ fontFamily: "var(--font-mono)" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={maxLength}
      />
      <Tooltip label={visible ? "隐藏明文" : "显示明文"} placement="top">
        <button
          type="button"
          className="password-eye-btn"
          aria-label={visible ? "隐藏明文" : "显示明文"}
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
