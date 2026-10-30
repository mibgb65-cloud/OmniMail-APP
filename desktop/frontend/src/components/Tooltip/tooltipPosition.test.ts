import { describe, expect, it } from 'vitest';
import { tooltipPosition, type TooltipSide } from './tooltipPosition';

const anchor = { left: 180, right: 220, top: 180, bottom: 220, width: 40, height: 40 };
const viewport = { width: 400, height: 400 };
const size = { width: 100, height: 40 };

describe('提示定位', () => {
  it.each<TooltipSide>(['top', 'bottom', 'left', 'right'])('空间足够时保持 %s', (side) => {
    const position = tooltipPosition(anchor, size, viewport, 8, 12, side);
    expect(position.side).toBe(side);
    expect(position.left).toBeGreaterThanOrEqual(12);
    expect(position.top).toBeGreaterThanOrEqual(12);
  });

  it('顶部空间不足自动翻转到底部', () => {
    const position = tooltipPosition(
      { ...anchor, top: 0, bottom: 40 },
      size,
      viewport,
      8,
      12,
      'top',
    );
    expect(position).toEqual({ side: 'bottom', left: 150, top: 48 });
  });

  it.each([
    { left: 0, right: 40, top: 0, bottom: 40 },
    { left: 360, right: 400, top: 360, bottom: 400 },
  ])('长文案在窗口角落也保留安全边距', (edges) => {
    const box = { width: 280, height: 100 };
    const result = tooltipPosition({ ...anchor, ...edges }, box, viewport, 8, 12, 'top');
    expect(result.left).toBeGreaterThanOrEqual(12);
    expect(result.top).toBeGreaterThanOrEqual(12);
    expect(result.left + box.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(result.top + box.height).toBeLessThanOrEqual(viewport.height - 12);
  });
});
