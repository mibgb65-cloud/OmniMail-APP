import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  children,
  size = "md",
  disabled = false,
  ariaLabel,
  style,
}: CheckboxProps) {
  const isMixed = indeterminate && !checked;
  const nextVal = isMixed ? true : !checked;
  const toggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!disabled) onChange(nextVal);
  };

  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={isMixed ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`checkbox-box${size === "sm" ? " sm" : ""}${checked ? " checked" : ""}${isMixed ? " mixed" : ""}`}
      onClick={toggle}
    >
      {checked ? (
        <Icon name="check" size={size === "sm" ? 11 : 12} />
      ) : isMixed ? (
        <Icon name="minus" size={size === "sm" ? 11 : 12} />
      ) : null}
    </button>
  );

  if (!children) return box;

  return (
    <div
      className="checkbox-row"
      data-disabled={disabled ? "true" : undefined}
      style={style}
      onClick={(e) => {
        if (disabled || (e.target as HTMLElement).closest("button")) return;
        onChange(nextVal);
      }}
    >
      {box}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}
