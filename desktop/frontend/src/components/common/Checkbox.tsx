import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
  size?: "sm" | "md";
  ariaLabel?: string;
  style?: CSSProperties;
}

export function Checkbox({
  checked,
  onChange,
  children,
  size = "md",
  ariaLabel,
  style,
}: CheckboxProps) {
  const toggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onChange(!checked);
  };

  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`checkbox-box${size === "sm" ? " sm" : ""}${checked ? " checked" : ""}`}
      onClick={toggle}
    >
      {checked && <Icon name="check" size={size === "sm" ? 11 : 12} />}
    </button>
  );

  if (!children) return box;

  return (
    <div
      className="checkbox-row"
      style={style}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onChange(!checked);
      }}
    >
      {box}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}
