import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { StartupScreen } from './StartupScreen';

function renderStartup(loading = false, onDismiss = vi.fn()) {
  const view = render(
    <StrictMode>
      <I18nProvider initialLocale="zh-CN">
        <StartupScreen loading={loading} onDismiss={onDismiss} />
      </I18nProvider>
    </StrictMode>,
  );
  return { ...view, onDismiss };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('启动过渡', () => {
  it('连接就绪后保留短暂展示，再完成退出，不依赖动画结束事件', () => {
    const { onDismiss } = renderStartup();
    expect(screen.getByRole('status')).toHaveTextContent('正在准备你的邮件工作空间');
    act(() => vi.advanceTimersByTime(1_099));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(240));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('服务未响应时最长等待后仍可进入工作台查看连接状态', () => {
    const { onDismiss } = renderStartup(true);
    act(() => vi.advanceTimersByTime(3_499));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(240));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('最短展示结束后才收到连接结果时，会立即开始退出', () => {
    const { onDismiss, rerender } = renderStartup(true);
    act(() => vi.advanceTimersByTime(1_200));
    expect(onDismiss).not.toHaveBeenCalled();
    rerender(
      <StrictMode>
        <I18nProvider initialLocale="zh-CN">
          <StartupScreen loading={false} onDismiss={onDismiss} />
        </I18nProvider>
      </StrictMode>,
    );
    act(() => vi.advanceTimersByTime(240));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('不展示跳过按钮，仍可通过 Esc 退出开屏', () => {
    const { onDismiss } = renderStartup(true);
    expect(screen.queryByRole('button', { name: /跳过动画/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(240));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('减少动态效果时不强制等待，卸载后移除偏好监听', () => {
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener })),
    );
    const { onDismiss, unmount } = renderStartup(true);
    act(() => vi.advanceTimersByTime(0));
    expect(onDismiss).toHaveBeenCalledOnce();
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('卸载清理计时器，避免关闭后回调', () => {
    const { onDismiss, unmount } = renderStartup();
    unmount();
    act(() => vi.runAllTimers());
    expect(onDismiss).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('播放期间开启减少动态效果，会取消等待并立即退出', () => {
    let updatePreference: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_name: string, listener: () => void) => {
        updatePreference = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    const { onDismiss } = renderStartup(true);
    act(() => {
      media.matches = true;
      updatePreference?.();
    });
    act(() => vi.advanceTimersByTime(0));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
