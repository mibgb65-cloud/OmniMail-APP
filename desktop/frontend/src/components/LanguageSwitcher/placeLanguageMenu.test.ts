import { afterEach, describe, expect, it, vi } from 'vitest';

import { placeLanguageMenu } from './placeLanguageMenu';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function position(anchor: DOMRect) {
  const menu = document.createElement('div');
  const trigger = document.createElement('button');
  menu.style.setProperty('--space-3', '8px');
  vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 180, 90));
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(anchor);
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 600);
  placeLanguageMenu(menu, trigger);
  return menu.style;
}

describe('语言菜单视口定位', () => {
  it('默认向下展开，靠左时限制到安全边距', () => {
    const style = position(new DOMRect(100, 20, 40, 40));
    expect(style.left).toBe('8px');
    expect(style.top).toBe('68px');
  });

  it('空间不足时向上展开，右边缘不能超出窗口', () => {
    const style = position(new DOMRect(390, 550, 40, 40));
    expect(style.left).toBe('202px');
    expect(style.top).toBe('452px');
  });
});
