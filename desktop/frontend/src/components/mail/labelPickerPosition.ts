import { computePopoverGeometry } from "../common/popoverPosition";
import { computeSidePopoverCoords } from "./labelPopoverLogic";

export function resolveLabelPickerStyle(opts: {
  anchorEl?: HTMLElement | null;
  anchorRect?: { left: number; top: number; right: number; bottom: number };
  x?: number;
  y?: number;
  cascade: boolean;
  popWidth: number;
  estHeight: number;
}): { left: number; top?: number; bottom?: number; side: string } {
  if (opts.cascade && opts.anchorRect) {
    return computeSidePopoverCoords(
      opts.anchorRect,
      opts.popWidth,
      opts.estHeight,
    );
  }
  if (opts.anchorEl) {
    const g = computePopoverGeometry(
      opts.anchorEl,
      opts.estHeight,
      opts.popWidth,
    );
    return { left: g.left, top: g.top, bottom: g.bottom, side: g.side };
  }
  const px = opts.x ?? opts.anchorRect?.left ?? 24;
  const py = opts.y ?? opts.anchorRect?.bottom ?? 24;
  const left = Math.max(
    10,
    Math.min(px, window.innerWidth - opts.popWidth - 12),
  );
  const top = Math.max(
    10,
    Math.min(py, window.innerHeight - opts.estHeight - 12),
  );
  return { left, top, side: "bottom" };
}
