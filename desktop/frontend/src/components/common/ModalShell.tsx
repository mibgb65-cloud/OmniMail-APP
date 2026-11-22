import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

interface ModalShellProps {
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  maxWidth?: number;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
  noPadding?: boolean;
}

export function ModalShell({
  title,
  subtitle,
  badge,
  maxWidth = 640,
  onClose,
  footer,
  children,
  headerRight,
  noPadding = false,
}: ModalShellProps) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        style={{ "--modal-max-w": `${maxWidth}px` } as CSSProperties}
      >
        {title && (
          <div className="modal-header">
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <h2 className="modal-title">{title}</h2>
                {badge}
              </div>
              {subtitle && <p className="modal-sub">{subtitle}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {headerRight}
              <button
                type="button"
                className="icon-btn icon-btn-bordered"
                onClick={onClose}
                aria-label="关闭弹窗"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        )}
        <div
          className={noPadding ? "" : "modal-body"}
          style={
            noPadding
              ? {
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }
              : undefined
          }
        >
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`switch-btn ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}
