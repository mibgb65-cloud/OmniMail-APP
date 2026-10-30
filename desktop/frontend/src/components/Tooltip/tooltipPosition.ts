export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

export function tooltipPosition(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap: number,
  inset: number,
  preferred: TooltipSide,
) {
  const opposite: Record<TooltipSide, TooltipSide> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const centerX = anchor.left + (anchor.width - size.width) / 2;
  const centerY = anchor.top + (anchor.height - size.height) / 2;
  const positions = {
    top: { left: centerX, top: anchor.top - size.height - gap },
    bottom: { left: centerX, top: anchor.bottom + gap },
    left: { left: anchor.left - size.width - gap, top: centerY },
    right: { left: anchor.right + gap, top: centerY },
  };
  const fits = (side: TooltipSide) => {
    const { left, top } = positions[side];
    return (
      left >= inset &&
      top >= inset &&
      left + size.width <= viewport.width - inset &&
      top + size.height <= viewport.height - inset
    );
  };
  const sides: TooltipSide[] = [preferred, opposite[preferred], 'top', 'bottom', 'right', 'left'];
  const side = sides.find(fits) ?? opposite[preferred];
  const clamp = (value: number, limit: number) => Math.max(inset, Math.min(value, limit - inset));
  return {
    side,
    left: clamp(positions[side].left, viewport.width - size.width),
    top: clamp(positions[side].top, viewport.height - size.height),
  };
}
