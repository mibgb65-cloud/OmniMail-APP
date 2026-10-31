import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './BrandMark';

describe('官方品牌图标', () => {
  it('大标识使用标准矢量资源，且不重复朗读相邻的应用名称', () => {
    render(<BrandMark className="brand-mark" />);
    const image = screen.getByAltText('');
    expect(image).toHaveAttribute('src', '/brand/omnimail.svg');
    expect(image).toHaveAttribute('aria-hidden', 'true');
    expect(image).toHaveAttribute('draggable', 'false');
    expect(image).toHaveClass('brand-mark');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('小尺寸与深色主题也使用同一完整图标，不切换简化版或重新着色', () => {
    const view = render(<BrandMark className="small" />);
    expect(screen.getByAltText('')).toHaveAttribute('src', '/brand/omnimail.svg');
    document.documentElement.dataset.theme = 'dark';
    view.rerender(<BrandMark className="small dark" />);
    expect(screen.getByAltText('')).toHaveAttribute('src', '/brand/omnimail.svg');
    delete document.documentElement.dataset.theme;
  });
});
