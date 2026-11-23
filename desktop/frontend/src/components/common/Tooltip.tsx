import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "bottom" | "top" | "right" | "left";

interface TooltipProps {
  label?: string;
  badge?: number | string;
  shortcut?: string;
  placement?: TooltipPlacement;
  delayMs?: number;
  children: ReactNode;
}

interface AnchorPos {
  left: number;
  top: number;
  side: TooltipPlacement;
}

let activeTooltipCount = 0;
let lastTooltipClosedAt = 0;

function getTargetElement(wrapper: HTMLElement): HTMLElement {
  return (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
}

export function Tooltip({
  label,
  badge,
  shortcut,
  placement = "bottom",
  delayMs = 350,
  children,
}: TooltipProps) {
  const [pos, setPos] = useState<AnchorPos | null>(null);
  const timerRef = useRef<number | null>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setPos(null);
  }, [clearTimer]);

  const computePos = useCallback(
    (el: HTMLElement, tipWidth = 120): AnchorPos => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (placement === "right") {
        return {
          left: Math.min(r.right + 8, vw - tipWidth - 8),
          top: Math.max(20, Math.min(r.top + r.height / 2, vh - 20)),
          side: "right",
        };
      }
      if (placement === "left") {
        return {
          left: Math.max(8, r.left - tipWidth - 8),
          top: Math.max(20, Math.min(r.top + r.height / 2, vh - 20)),
          side: "left",
        };
      }

      const flipTop = placement === "top" || r.bottom + 40 > vh;
      const top = flipTop ? Math.max(8, r.top - 36) : r.bottom + 6;
      const centeredLeft = r.left + r.width / 2 - tipWidth / 2;
      return {
        left: Math.max(8, Math.min(centeredLeft, vw - tipWidth - 8)),
        top,
        side: flipTop ? "top" : "bottom",
      };
    },
    [placement],
  );

  const scheduleShow = useCallback(
    (wrapperEl: HTMLElement) => {
      if (!label) return;
      const target = getTargetElement(wrapperEl);
      triggerElRef.current = target;
      clearTimer();
      const isWarm =
        activeTooltipCount > 0 || Date.now() - lastTooltipClosedAt < 280;
      if (isWarm) {
        setPos(computePos(target));
        return;
      }
      timerRef.current = window.setTimeout(() => {
        if (target.isConnected) setPos(computePos(target));
      }, delayMs);
    },
    [label, clearTimer, computePos, delayMs],
  );

  useEffect(() => {
    if (!pos) return;
    activeTooltipCount += 1;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      activeTooltipCount = Math.max(0, activeTooltipCount - 1);
      lastTooltipClosedAt = Date.now();
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      clearTimer();
    };
  }, [pos, hide, clearTimer]);

  const measureRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !triggerElRef.current) return;
      const next = computePos(triggerElRef.current, node.offsetWidth);
      setPos((prev) =>
        prev && Math.abs(prev.left - next.left) > 1 ? next : prev,
      );
    },
    [computePos],
  );

  if (!label) return <>{children}</>;

  return (
    <>
      <span
        style={{ display: "contents" }}
        onMouseEnter={(e: MouseEvent<HTMLElement>) =>
          scheduleShow(e.currentTarget)
        }
        onMouseLeave={hide}
        onFocus={(e: FocusEvent<HTMLElement>) => {
          const target = e.target as HTMLElement | null;
          if (target?.matches?.(":focus-visible")) {
            scheduleShow(e.currentTarget);
          }
        }}
        onBlur={hide}
        onMouseDown={hide}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            ref={measureRef}
            role="tooltip"
            data-side={pos.side}
            className="custom-tooltip"
            style={{ left: pos.left, top: pos.top }}
          >
            <span>{label}</span>
            {badge !== undefined && Number(badge) > 0 && (
              <span className="tooltip-badge">{badge}</span>
            )}
            {shortcut && <kbd className="tooltip-kbd">{shortcut}</kbd>}
          </div>,
          document.body,
        )}
    </>
  );
}
