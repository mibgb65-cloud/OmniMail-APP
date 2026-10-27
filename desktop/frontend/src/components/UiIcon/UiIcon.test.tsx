import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UiIcon } from './UiIcon';

afterEach(() => vi.unstubAllGlobals());

describe('Morphicons 功能图标', () => {
  it.each([
    'compose',
    'workspace',
    'inbox',
    'starred',
    'sent',
    'drafts',
    'archive',
    'deleted',
    'mailOpen',
    'sparkles',
    'panelRightClose',
    'panelRightOpen',
    'accounts',
    'settings',
    'replay',
    'sun',
    'moon',
    'minimize',
    'maximize',
    'restore',
    'close',
    'bell',
    'language',
    'check',
    'chevronDown',
    'chevronUp',
    'general',
    'about',
    'search',
    'sync',
    'markAllRead',
    'previous',
    'next',
  ] as const)('%s 使用统一样式且保持装饰性语义', (name) => {
    const view = render(<UiIcon name={name} />);
    const svg = view.container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '1.6');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('允许空态等场景增大尺寸并保留组件样式类', () => {
    const view = render(<UiIcon name="bell" size={32} className="empty-icon" />);
    expect(view.container.querySelector('svg')).toHaveAttribute('width', '32');
    expect(view.container.querySelector('svg')).toHaveClass('empty-icon');
  });

  it('图标状态改变时复用 SVG，以支持 Morphicons 变形', () => {
    const view = render(<UiIcon name="moon" />);
    const svg = view.container.querySelector('svg');
    view.rerender(<UiIcon name="sun" />);
    expect(view.container.querySelector('svg')).toBe(svg);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('选中状态变化复用 SVG，保持图标名称和装饰性语义', () => {
    const view = render(<UiIcon name="inbox" selected={false} />);
    const svg = view.container.querySelector('svg');
    view.rerender(<UiIcon name="inbox" selected />);
    expect(view.container.querySelector('svg')).toBe(svg);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it.each(['inbox', 'starred', 'sent', 'drafts', 'archive', 'deleted'] as const)(
    '%s 取消选中为 outline，选中为 fill，双向切换复用 SVG',
    async (name) => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
      const view = render(<UiIcon name={name} selected={false} />);
      const svg = view.container.querySelector('svg');
      expect(svg?.querySelector('path')).not.toHaveAttribute('fill', 'currentColor');
      view.rerender(<UiIcon name={name} selected />);
      await waitFor(() =>
        expect(svg?.querySelector('path')).toHaveAttribute('fill', 'currentColor'),
      );
      expect(svg?.querySelector('path')).toHaveAttribute('stroke', 'none');
      expect(view.container.querySelector('svg')).toBe(svg);
      view.rerender(<UiIcon name={name} selected={false} />);
      await waitFor(() =>
        expect(svg?.querySelector('path')).not.toHaveAttribute('fill', 'currentColor'),
      );
      expect(view.container.querySelector('svg')).toBe(svg);
    },
  );
});
