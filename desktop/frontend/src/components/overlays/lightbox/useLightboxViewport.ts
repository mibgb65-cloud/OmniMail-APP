import { useCallback, useRef, useState, type RefObject } from "react";

export const LIGHTBOX_MIN_SCALE = 0.25;
export const LIGHTBOX_MAX_SCALE = 4;

interface TransformState {
  scale: number;
  fitMode: boolean;
  rotation: number;
  x: number;
  y: number;
}

const INITIAL_TRANSFORM: TransformState = {
  scale: 1,
  fitMode: true,
  rotation: 0,
  x: 0,
  y: 0,
};

function clampScale(value: number): number {
  return Math.min(
    LIGHTBOX_MAX_SCALE,
    Math.max(LIGHTBOX_MIN_SCALE, Math.round(value * 100) / 100),
  );
}

export function useLightboxViewport(
  stageRef: RefObject<HTMLDivElement | null>,
) {
  const [tf, setTf] = useState<TransformState>(INITIAL_TRANSFORM);
  const [dragging, setDragging] = useState(false);
  const dragOriginRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const resetViewport = useCallback(() => {
    dragOriginRef.current = null;
    setDragging(false);
    setTf(INITIAL_TRANSFORM);
  }, []);

  const zoomByStep = useCallback((delta: number) => {
    setTf((prev) => {
      const nextScale = clampScale(prev.scale + delta);
      return {
        ...prev,
        scale: nextScale,
        fitMode: false,
        x: nextScale <= 1 ? 0 : prev.x,
        y: nextScale <= 1 ? 0 : prev.y,
      };
    });
  }, []);

  const zoomIn = useCallback(() => zoomByStep(0.25), [zoomByStep]);
  const zoomOut = useCallback(() => zoomByStep(-0.25), [zoomByStep]);

  const fitToWindow = useCallback(() => {
    setTf((prev) => ({ ...prev, scale: 1, fitMode: true, x: 0, y: 0 }));
  }, []);

  const toggleFitOrActual = useCallback(() => {
    setTf((prev) =>
      prev.fitMode
        ? { ...prev, scale: 1, fitMode: false, x: 0, y: 0 }
        : { ...prev, scale: 1, fitMode: true, x: 0, y: 0 },
    );
  }, []);

  const rotateRight = useCallback(() => {
    setTf((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
      x: 0,
      y: 0,
    }));
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const stage = stageRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      let px = 0;
      let py = 0;
      if (stage) {
        const rect = stage.getBoundingClientRect();
        px = e.clientX - (rect.left + rect.width / 2);
        py = e.clientY - (rect.top + rect.height / 2);
      }
      setTf((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        if (nextScale === prev.scale) return prev;
        const ratio = nextScale / prev.scale;
        const nextX = nextScale <= 1 ? 0 : px - (px - prev.x) * ratio;
        const nextY = nextScale <= 1 ? 0 : py - (py - prev.y) * ratio;
        return {
          ...prev,
          scale: nextScale,
          fitMode: false,
          x: nextX,
          y: nextY,
        };
      });
    },
    [stageRef],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      if (e.button !== 0 || (tf.fitMode && tf.scale <= 1)) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragOriginRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseX: tf.x,
        baseY: tf.y,
      };
      setDragging(true);
    },
    [tf.fitMode, tf.scale, tf.x, tf.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      const origin = dragOriginRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;
      const dx = e.clientX - origin.startX;
      const dy = e.clientY - origin.startY;
      setTf((prev) => ({
        ...prev,
        x: origin.baseX + dx,
        y: origin.baseY + dy,
      }));
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      const origin = dragOriginRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;
      dragOriginRef.current = null;
      setDragging(false);
    },
    [],
  );

  return {
    transform: tf,
    dragging,
    canPan: !tf.fitMode || tf.scale > 1,
    zoomPct: Math.round(tf.scale * 100),
    resetViewport,
    zoomIn,
    zoomOut,
    fitToWindow,
    toggleFitOrActual,
    rotateRight,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
