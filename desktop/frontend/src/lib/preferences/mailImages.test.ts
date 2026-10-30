import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { IMAGE_POLICY_STORAGE_KEY, setImagePolicy, useImagePolicy } from './mailImages';

beforeEach(() => localStorage.clear());

it('默认仅内嵌，合法偏好即时共享并持久化，非法值安全回退', () => {
  const a = renderHook(useImagePolicy);
  const b = renderHook(useImagePolicy);
  expect(a.result.current).toBe('inline');
  act(() => {
    setImagePolicy('all');
  });
  expect(a.result.current).toBe('all');
  expect(b.result.current).toBe('all');
  expect(localStorage.getItem(IMAGE_POLICY_STORAGE_KEY)).toBe('all');
  act(() => {
    setImagePolicy('none');
  });
  expect(a.result.current).toBe('none');
  expect(setImagePolicy('not-a-policy')).toBe(false);
  localStorage.setItem(IMAGE_POLICY_STORAGE_KEY, '<script>');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: IMAGE_POLICY_STORAGE_KEY })));
  expect(a.result.current).toBe('inline');
});

it('保存被禁时保留会话偏好并返回失败，不崩溃或静默扩大图片权限', () => {
  const view = renderHook(useImagePolicy);
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  act(() => {
    expect(setImagePolicy('none')).toBe(false);
  });
  expect(view.result.current).toBe('none');
  blocked.mockRestore();
  act(() => {
    setImagePolicy('inline');
  });
});
