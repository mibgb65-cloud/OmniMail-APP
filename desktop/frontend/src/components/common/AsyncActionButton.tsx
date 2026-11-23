import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AsyncStateGlyph,
  waitSuccessHold,
  type AsyncActionStatus,
} from "./AsyncStateGlyph";
import { Icon, type IconName } from "./Icon";

export { AsyncStateGlyph, waitSuccessHold, type AsyncActionStatus };

export interface AsyncActionButtonProps {
  status: AsyncActionStatus;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
  idleLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  idleIcon?: IconName;
  disabled?: boolean;
  successHoldMs?: number;
  onSuccessHoldEnd?: () => void;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function AsyncActionButton({
  status,
  variant = "primary",
  size = "md",
  idleLabel,
  loadingLabel = "处理中…",
  successLabel = "操作成功",
  errorLabel = "操作失败 · 重试",
  idleIcon,
  disabled = false,
  successHoldMs = 900,
  onSuccessHoldEnd,
  onClick,
  className = "",
  style,
  ariaLabel,
}: AsyncActionButtonProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const holdCbRef = useRef(onSuccessHoldEnd);
  const [lockedWidth, setLockedWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    holdCbRef.current = onSuccessHoldEnd;
  }, [onSuccessHoldEnd]);

  useLayoutEffect(() => {
    if (status === "idle" && btnRef.current) {
      const w = btnRef.current.offsetWidth;
      if (w > 0) setLockedWidth(w);
    }
  }, [status, idleLabel]);

  useEffect(() => {
    if (status !== "success" || !holdCbRef.current) return;
    const timer = window.setTimeout(() => {
      holdCbRef.current?.();
    }, successHoldMs);
    return () => window.clearTimeout(timer);
  }, [status, successHoldMs]);

  const activeText =
    status === "loading"
      ? loadingLabel
      : status === "success"
        ? successLabel
        : status === "error"
          ? errorLabel
          : idleLabel;

  const isBlocked = status === "loading" || status === "success";
  const nativeDisabled = status === "idle" && disabled;
  const glyphSize = size === "sm" ? 14 : 16;

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={nativeDisabled}
      aria-busy={status === "loading" ? "true" : undefined}
      aria-live="polite"
      aria-label={ariaLabel}
      data-status={status}
      data-variant={variant}
      className={`btn ${size === "sm" ? "btn-sm" : ""} async-action-btn ${className}`.trim()}
      style={{
        ...(status !== "idle" && lockedWidth ? { minWidth: lockedWidth } : {}),
        ...style,
      }}
      onClick={() => {
        if (isBlocked || nativeDisabled) return;
        onClick?.();
      }}
    >
      {status === "idle" ? (
        idleIcon ? (
          <Icon name={idleIcon} size={size === "sm" ? 13 : 14} />
        ) : null
      ) : (
        <AsyncStateGlyph status={status} size={glyphSize} />
      )}
      <span key={status} className="async-btn-label">
        {activeText}
      </span>
    </button>
  );
}
