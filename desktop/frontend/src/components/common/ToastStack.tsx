import type { ToastNotice } from "../../types/ui";
import { Icon } from "./Icon";

interface ToastStackProps {
  toasts: ToastNotice[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-item">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <Icon
              name={
                toast.tone === "danger"
                  ? "alertCircle"
                  : toast.tone === "success"
                    ? "checkCircle"
                    : "info"
              }
              size={16}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{toast.title}</div>
              {toast.detail && (
                <div style={{ fontSize: 12, opacity: 0.78 }}>
                  {toast.detail}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: "rgba(255,255,255,0.16)",
                  color: "inherit",
                  border: "1px solid rgba(255,255,255,0.25)",
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
              style={{ color: "inherit", width: 26, height: 26 }}
              onClick={() => onDismiss(toast.id)}
              aria-label="关闭通知"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
