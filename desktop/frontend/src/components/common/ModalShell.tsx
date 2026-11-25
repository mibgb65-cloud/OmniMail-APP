import type { CSSProperties, ReactNode } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { FadeScroll } from "./scroll-fade/FadeScroll";

interface ModalShellProps {
  heading?: string;
  subtitle?: string;
  badge?: ReactNode;
  maxWidth?: number;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
  noPadding?: boolean;
  cardClassName?: string;
  backdropClassName?: string;
  ariaLabel?: string;
}

export function ModalShell({
  heading,
  subtitle,
  badge,
  maxWidth = 640,
  onClose,
  footer,
  children,
  headerRight,
  noPadding = false,
  cardClassName,
  backdropClassName,
  ariaLabel,
}: ModalShellProps) {
  const { t } = useI18n();

  return (
    <div
      className={
        backdropClassName
          ? `modal-backdrop ${backdropClassName}`
          : "modal-backdrop"
      }
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? heading}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cardClassName ? `modal-card ${cardClassName}` : "modal-card"}
        style={{ "--modal-max-w": `${maxWidth}px` } as CSSProperties}
      >
        {heading && (
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
                <h2 className="modal-title">{heading}</h2>
                {badge}
              </div>
              {subtitle && <p className="modal-sub">{subtitle}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {headerRight}
              <Tooltip label={t("common.closeModal")} shortcut="Esc">
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered"
                  onClick={onClose}
                  aria-label={t("common.closeModal")}
                >
                  <Icon name="x" size={15} />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {noPadding ? (
          <div className="pcm-stage-slot">
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children}
            </div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        ) : (
          <>
            <FadeScroll
              className="modal-body"
              label={
                heading
                  ? t("common.modalBodyNamed", { heading })
                  : t("common.modalBody")
              }
            >
              {children}
            </FadeScroll>
            {footer && <div className="modal-footer">{footer}</div>}
          </>
        )}
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
