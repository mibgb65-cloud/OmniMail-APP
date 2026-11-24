import { useRef } from "react";
import { useI18n } from "../../i18n";

export interface AiResizeHandleProps {
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  onDragging: (dragging: boolean) => void;
}

export function AiResizeHandle({
  width,
  min,
  max,
  onResize,
  onDragging,
}: AiResizeHandleProps) {
  const { t } = useI18n();
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(
    null,
  );

  return (
    <div
      className="ai-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label={t("ai.resizeAria")}
      aria-controls="mail-ai-pane"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={t("ai.resizeValueText", { width })}
      title={t("ai.resizeTitle")}
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0) return;
        drag.current = { pointer: e.pointerId, x: e.clientX, width };
        e.currentTarget.setPointerCapture(e.pointerId);
        onDragging(true);
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (start?.pointer === e.pointerId)
          onResize(start.width + start.x - e.clientX);
      }}
      onLostPointerCapture={(e) => {
        if (drag.current?.pointer !== e.pointerId) return;
        drag.current = null;
        onDragging(false);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 8;
        const next = {
          ArrowLeft: width + step,
          ArrowRight: width - step,
          Home: min,
          End: max,
        }[e.key as "ArrowLeft" | "ArrowRight" | "Home" | "End"];
        if (typeof next !== "number") return;
        e.preventDefault();
        e.stopPropagation();
        onResize(next);
      }}
    />
  );
}
