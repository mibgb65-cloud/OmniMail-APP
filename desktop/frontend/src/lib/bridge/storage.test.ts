import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { afterEach, expect, it, vi } from 'vitest';
import { Usage } from '../../../bindings/omnimail/desktop/internal/bridge/storagebridge';
import { getStorageUsage, isStorageUsage, type StorageUsage } from './storage';

vi.mock('../../../bindings/omnimail/desktop/internal/bridge/storagebridge', () => ({
  Usage: vi.fn(),
}));
const usage: StorageUsage = {
  totalBytes: 10,
  mailDataBytes: 5,
  attachmentsBytes: 2,
  logsBytes: 1,
  backupsBytes: 1,
  otherBytes: 1,
};
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(Usage).mockReset();
});

it('校验整数、分类总和以及空目录', () => {
  expect(isStorageUsage(usage)).toBe(true);
  expect(isStorageUsage(Object.fromEntries(Object.keys(usage).map((key) => [key, 0])))).toBe(true);
});
it.each([
  null,
  [],
  {},
  { ...usage, totalBytes: 11 },
  { ...usage, logsBytes: -1 },
  { ...usage, otherBytes: 0.5 },
  { ...usage, mailDataBytes: '5' },
  { ...usage, logsBytes: undefined },
  { ...usage, totalBytes: NaN },
  { ...usage, totalBytes: Number.MAX_SAFE_INTEGER + 1 },
])('拒绝不可信 DTO %#', (value) => {
  expect(isStorageUsage(value)).toBe(false);
});
it('读取真实桥接返回值', async () => {
  vi.mocked(Usage).mockReturnValue(new CancellablePromise((resolve) => resolve(usage)));
  await expect(getStorageUsage()).resolves.toEqual(usage);
});
it('对底层错误和非法 DTO 返回统一安全错误', async () => {
  vi.mocked(Usage).mockReturnValue(
    new CancellablePromise((_, reject) => reject(new Error('private-path-and-token'))),
  );
  await expect(getStorageUsage()).rejects.toThrow('无法读取本机存储情况，请在桌面应用中重试。');
  vi.mocked(Usage).mockReturnValue(
    new CancellablePromise((resolve) => resolve({ ...usage, totalBytes: -1 })),
  );
  await expect(getStorageUsage()).rejects.toThrow('无法读取本机存储情况');
});
it('取消调用与超时会取消 IPC 并释放计时器', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const request = new CancellablePromise<StorageUsage>(() => {});
  const cancel = vi.spyOn(request, 'cancel');
  vi.mocked(Usage).mockReturnValue(request);
  const result = expect(getStorageUsage(controller.signal)).rejects.toThrow('无法读取本机存储情况');
  controller.abort();
  await result;
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  vi.mocked(Usage).mockReturnValue(new CancellablePromise<StorageUsage>(() => {}));
  const timeout = expect(getStorageUsage()).rejects.toThrow('无法读取本机存储情况');
  await vi.advanceTimersByTimeAsync(12_000);
  await timeout;
  expect(vi.getTimerCount()).toBe(0);
});
