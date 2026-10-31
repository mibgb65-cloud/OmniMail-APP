import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  MAIL_DARK_MODE_STORAGE_KEY,
  setMailFollowsDarkMode,
  useMailFollowsDarkMode,
} from './mailAppearance';

beforeEach(() => localStorage.clear());

it('默认跟随暗色，修改共享并持久化，重挂载恢复偏好', () => {
  const a = renderHook(useMailFollowsDarkMode),
    b = renderHook(useMailFollowsDarkMode);
  expect(a.result.current).toBe(true);
  act(() => {
    expect(setMailFollowsDarkMode(false)).toBe(true);
  });
  expect(a.result.current).toBe(false);
  expect(b.result.current).toBe(false);
  expect(localStorage.getItem(MAIL_DARK_MODE_STORAGE_KEY)).toBe('false');
  a.unmount();
  expect(renderHook(useMailFollowsDarkMode).result.current).toBe(false);
  act(() => {
    setMailFollowsDarkMode(true);
  });
});

it('只接受布尔输入，损坏或清除的存储回退默认值，支持外部存储通知', () => {
  const view = renderHook(useMailFollowsDarkMode);
  expect(setMailFollowsDarkMode('false')).toBe(false);
  expect(setMailFollowsDarkMode(null)).toBe(false);
  localStorage.setItem(MAIL_DARK_MODE_STORAGE_KEY, 'false');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: MAIL_DARK_MODE_STORAGE_KEY })));
  expect(view.result.current).toBe(false);
  localStorage.setItem(MAIL_DARK_MODE_STORAGE_KEY, '<script>');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: MAIL_DARK_MODE_STORAGE_KEY })));
  expect(view.result.current).toBe(true);
  localStorage.clear();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(view.result.current).toBe(true);
});

it('存储失败时保留会话选择且返回失败，成功保存后恢复正常持久化', () => {
  const view = renderHook(useMailFollowsDarkMode);
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('private-marker');
  });
  act(() => {
    expect(setMailFollowsDarkMode(false)).toBe(false);
  });
  expect(view.result.current).toBe(false);
  const reading = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('private-marker');
  });
  expect(renderHook(useMailFollowsDarkMode).result.current).toBe(false);
  reading.mockRestore();
  blocked.mockRestore();
  act(() => {
    expect(setMailFollowsDarkMode(true)).toBe(true);
  });
  expect(view.result.current).toBe(true);
});
