import { useEffect, useState, type RefObject } from "react";
import { aiWidthRange, clampAiWidth, DEFAULT_AI_WIDTH } from "./aiPanelWidth";

const widthKey = "omnimail.ai-panel-width";

function readWidth() {
  try {
    const saved = window.localStorage.getItem(widthKey);
    return saved === null
      ? DEFAULT_AI_WIDTH
      : clampAiWidth(Number(saved), 280, 640);
  } catch {
    return DEFAULT_AI_WIDTH;
  }
}

export function useAiPanelResize(
  stageRef: RefObject<HTMLDivElement | null>,
  docked: boolean,
  visible: boolean,
) {
  const [preferred, setPreferred] = useState(readWidth);
  const [range, setRange] = useState(() => aiWidthRange(640));
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !visible) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(stage);
      const px = (name: string) =>
        Number.parseFloat(style.getPropertyValue(name));
      const reserved = docked
        ? px("--mail-sidebar-width") +
          px("--mail-list-width") +
          px("--ai-min-reader-width") +
          3 * px("--workspace-column-gap")
        : 16;
      const next = aiWidthRange(stage.clientWidth - reserved);
      setRange((prev) =>
        prev.min === next.min && prev.max === next.max ? prev : next,
      );
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef, docked, visible]);

  useEffect(() => {
    if (isResizing) return;
    try {
      window.localStorage.setItem(widthKey, String(preferred));
    } catch {
      // 存储不可用时仍保留本次会话内的宽度。
    }
  }, [preferred, isResizing]);

  const width = clampAiWidth(preferred, range.min, range.max);
  return {
    width,
    isResizing,
    separator: {
      ...range,
      width,
      onResize: (next: number) =>
        setPreferred(clampAiWidth(next, range.min, range.max)),
      onDragging: setIsResizing,
    },
  };
}
