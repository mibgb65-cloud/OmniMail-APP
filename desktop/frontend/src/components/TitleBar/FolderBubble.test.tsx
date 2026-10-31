import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FolderBubble } from './FolderBubble';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('分类气泡', () => {
  it('旧文字淡出后完整显示省略号，再展开新标题', () => {
    const view = render(<FolderBubble title="全部收件箱" />);
    const heading = screen.getByRole('heading', { name: '全部收件箱' });
    view.rerender(<FolderBubble title="星标邮件" />);
    expect(heading).toHaveAccessibleName('星标邮件');
    expect(heading).toHaveTextContent('全部收件箱');
    act(() => vi.advanceTimersByTime(160));
    expect(heading).toHaveTextContent('……');
    act(() => vi.advanceTimersByTime(739));
    expect(heading).toHaveTextContent('……');
    expect(heading.querySelector('[data-phase]')).toHaveAttribute('data-phase', 'ellipsis');
    act(() => vi.advanceTimersByTime(161));
    expect(heading).toHaveTextContent('星标邮件');
    expect(heading.querySelector('[data-phase]')).toHaveAttribute('data-phase', 'enter');
    act(() => vi.advanceTimersByTime(540));
    expect(heading.querySelector('[data-phase]')).toHaveAttribute('data-phase', 'idle');
  });

  it('省略号显示期间连续选择只切换至最新标题', () => {
    const view = render(<FolderBubble title="全部收件箱" />);
    view.rerender(<FolderBubble title="星标邮件" />);
    act(() => vi.advanceTimersByTime(300));
    view.rerender(<FolderBubble title="草稿箱" />);
    act(() => vi.advanceTimersByTime(1_059));
    const heading = screen.getByRole('heading', { name: '草稿箱' });
    expect(heading).toHaveTextContent('……');
    act(() => vi.advanceTimersByTime(541));
    expect(heading).toHaveTextContent('草稿箱');
    expect(heading.querySelector('[data-phase]')).toHaveAttribute('data-phase', 'idle');
  });

  it('启用减少动态效果时立即显示新文字', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const view = render(<FolderBubble title="全部收件箱" />);
    view.rerender(<FolderBubble title="星标邮件" />);
    expect(screen.getByRole('heading', { name: '星标邮件' })).toHaveTextContent('星标邮件');
  });

  it('过渡中启用减少动态效果会立即显示最新文字', () => {
    let change: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: string, callback: () => void) => {
        change = callback;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    const view = render(<FolderBubble title="全部收件箱" />);
    view.rerender(<FolderBubble title="星标邮件" />);
    expect(screen.getByRole('heading', { name: '星标邮件' })).toHaveTextContent('全部收件箱');
    act(() => {
      media.matches = true;
      change?.();
    });
    expect(screen.getByRole('heading', { name: '星标邮件' })).toHaveTextContent('星标邮件');
  });

  it('卸载后清理延迟切换', () => {
    const view = render(<FolderBubble title="全部收件箱" />);
    view.rerender(<FolderBubble title="星标邮件" />);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
