import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, isTheme, persistTheme, readInitialTheme, THEME_STORAGE_KEY } from './theme';
import { useTheme } from './useTheme';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

function mockSystemTheme(dark: boolean) {
  let listener: (() => void) | undefined;
  const media = {
    matches: dark,
    addEventListener: vi.fn((_event: string, callback: () => void) => {
      listener = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return {
    media,
    change(matches: boolean) {
      media.matches = matches;
      act(() => listener?.());
    },
  };
}

describe('主题偏好', () => {
  it.each([null, undefined, '', 'system', '<script>', {}, 1])('拒绝非法主题 %j', (value) => {
    expect(isTheme(value)).toBe(false);
  });

  it('首次跟随系统，且不自动写入手动偏好', () => {
    mockSystemTheme(true);
    expect(readInitialTheme()).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('已保存的合法选择优先于系统，非法存储回退到系统', () => {
    mockSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(readInitialTheme()).toBe('light');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid-theme');
    expect(readInitialTheme()).toBe('dark');
  });

  it('缺少媒体查询能力或存储被禁用时仍能启动', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private diagnostic');
    });
    expect(readInitialTheme()).toBe('light');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private diagnostic');
    });
    expect(persistTheme('dark')).toBe(false);
    applyTheme('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('系统变化实时生效，手动切换后保持选择并清理监听', () => {
    const system = mockSystemTheme(false);
    const view = renderHook(useTheme);
    expect(view.result.current.theme).toBe('light');
    system.change(true);
    expect(view.result.current.theme).toBe('dark');
    act(() => view.result.current.toggleTheme());
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    system.change(false);
    system.change(true);
    expect(view.result.current.theme).toBe('light');
    view.unmount();
    expect(system.media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('已保存的主题不会被系统事件覆盖，重挂载后仍恢复', () => {
    const system = mockSystemTheme(false);
    persistTheme('dark');
    const view = renderHook(useTheme);
    system.change(false);
    expect(view.result.current.theme).toBe('dark');
    view.unmount();
    expect(renderHook(useTheme).result.current.theme).toBe('dark');
  });

  it('存储写入失败时，本次手动选择仍然优先', () => {
    const system = mockSystemTheme(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const view = renderHook(useTheme);
    act(() => view.result.current.toggleTheme());
    system.change(false);
    expect(view.result.current.theme).toBe('dark');
  });
});
