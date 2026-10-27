import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Version } from '../../../bindings/omnimail/desktop/internal/bridge/appbridge';
import { VERSION_INFO } from '../../test/fixtures';
import { getVersion, isVersionInfo, type VersionInfo } from './app';

vi.mock('../../../bindings/omnimail/desktop/internal/bridge/appbridge', () => ({
  Version: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(Version).mockReset();
});

describe('版本 DTO 校验', () => {
  it('接受构建信息和未注入的开发信息', () => {
    expect(isVersionInfo(VERSION_INFO)).toBe(true);
    expect(isVersionInfo({ ...VERSION_INFO, commit: 'unknown', buildTime: 'unknown' })).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { ...VERSION_INFO, version: 1 },
    { ...VERSION_INFO, version: 'x'.repeat(65) },
    { ...VERSION_INFO, commit: '<script>' },
    { ...VERSION_INFO, platform: 'windows\namd64' },
    { ...VERSION_INFO, goVersion: '' },
    { ...VERSION_INFO, buildTime: 'invalid-date' },
    { ...VERSION_INFO, buildTime: '2026-99-99T99:99:99Z' },
  ])('拒绝非法外部数据 %#', (value) => {
    expect(isVersionInfo(value)).toBe(false);
  });
});

describe('桌面服务封装', () => {
  it('读取 Go 返回值', async () => {
    vi.mocked(Version).mockReturnValue(new CancellablePromise((resolve) => resolve(VERSION_INFO)));
    await expect(getVersion()).resolves.toEqual(VERSION_INFO);
  });

  it('拒绝非法 DTO，不泄漏原始响应', async () => {
    // 故意绕过静态类型，模拟不可信 IPC 数据。
    vi.mocked(Version).mockReturnValue(
      new CancellablePromise((resolve) =>
        resolve({ password: 'secret' } as unknown as VersionInfo),
      ),
    );
    await expect(getVersion()).rejects.toThrow('无法读取桌面服务信息');
  });

  it('将底层错误替换为安全文案', async () => {
    vi.mocked(Version).mockReturnValue(
      new CancellablePromise((_, reject) => reject(new Error('token=private-token'))),
    );
    await expect(getVersion()).rejects.toThrow('无法读取桌面服务信息，请在桌面应用中重试。');
  });

  it('10 秒超时会取消挂起的请求', async () => {
    vi.useFakeTimers();
    const request = new CancellablePromise<VersionInfo>(() => {});
    const cancel = vi.spyOn(request, 'cancel');
    vi.mocked(Version).mockReturnValue(request);
    const result = expect(getVersion()).rejects.toThrow('无法读取桌面服务信息');
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('调用方取消时终止请求', async () => {
    const controller = new AbortController();
    const request = new CancellablePromise<VersionInfo>(() => {});
    const cancel = vi.spyOn(request, 'cancel');
    vi.mocked(Version).mockReturnValue(request);
    const result = expect(getVersion(controller.signal)).rejects.toThrow('无法读取桌面服务信息');
    controller.abort();
    await result;
    expect(cancel).toHaveBeenCalledOnce();
  });
});
