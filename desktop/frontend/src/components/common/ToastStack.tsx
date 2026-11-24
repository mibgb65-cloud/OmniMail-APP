import type { CSSProperties } from "react";
import { useI18n } from "../../i18n";
import type { ToastNotice } from "../../types/ui";
import { Icon } from "./Icon";

interface ToastStackProps {
  toasts: ToastNotice[];
  onDismiss: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

const DOT_COLORS: Record<ToastNotice["tone"], string> = {
  success: "#4ade80",
  info: "#60a5fa",
  warning: "#fbbf24",
  danger: "#f87171",
};

export function ToastStack({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: ToastStackProps) {
  const { t } = useI18n();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-exiting={toast.exiting ? "true" : "false"}
          className="toast-item"
          onMouseEnter={() => onPause?.(toast.id)}
          onMouseLeave={() => onResume?.(toast.id)}
        >
          <div className="row-between" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 9, minWidth: 0, flex: 1 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DOT_COLORS[toast.tone],
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600 }}>
                  {toast.title}
                </div>
                {toast.detail && (
                  <div
                    className="truncate"
                    style={{ fontSize: 11.5, color: "#94a3b8" }}
                  >
                    {toast.detail}
                  </div>
                )}
              </div>
            </div>

            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    height: 26,
                    padding: "0 10px",
                    borderRadius: 6,
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                  onClick={() => {
                    toast.onAction?.();
                    onDismiss(toast.id);
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                style={{ color: "#94a3b8", width: 24, height: 24 }}
                onClick={() => onDismiss(toast.id)}
                aria-label={t("common.dismissNotice")}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          </div>

          {toast.actionLabel && (
            <div className="toast-progress-track">
              <div
                className="toast-progress-bar"
                style={
                  {
                    "--toast-dur": `${toast.durationMs ?? 5000}ms`,
                  } as CSSProperties
                }
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
