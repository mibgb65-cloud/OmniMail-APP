import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { afterEach, expect, it, vi } from 'vitest';
import { InitialLocale } from '../../../bindings/omnimail/desktop/internal/bridge/installationbridge';
import { readInstallationLocale } from './installation';

vi.mock('@wailsio/runtime', () => ({ System: { IsDesktop: () => true } }));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/installationbridge', () => ({
  InitialLocale: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());

it('只接受白名单安装语言，不信任桥接响应', async () => {
  for (const value of ['en', 'zh-CN', '', '<script>', 'en-US']) {
    vi.mocked(InitialLocale).mockReturnValue(new CancellablePromise((resolve) => resolve(value)));
    await expect(readInstallationLocale()).resolves.toBe(
      value === 'en' || value === 'zh-CN' ? value : null,
    );
  }
});

it('桥接错误不泄露路径，取消后不发起请求', async () => {
  vi.mocked(InitialLocale).mockReturnValue(
    new CancellablePromise((_, reject) => reject(new Error('sensitive-local-path'))),
  );
  await expect(readInstallationLocale()).resolves.toBeNull();
  vi.mocked(InitialLocale).mockClear();
  const controller = new AbortController();
  controller.abort();
  await expect(readInstallationLocale(controller.signal)).resolves.toBeNull();
  expect(InitialLocale).not.toHaveBeenCalled();
});
