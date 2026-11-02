import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { System } from '@wailsio/runtime';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Create,
  List,
} from '../../../bindings/omnimail/desktop/internal/bridge/customprovidersbridge';
import { AuthKind, TLSMode } from './mail';
import { Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import { createCustomProvider, isSavedProvider, listCustomProviders } from './customProviders';
vi.mock('@wailsio/runtime', () => ({ System: { IsDesktop: vi.fn(() => true) } }));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/customprovidersbridge', () => ({
  Create: vi.fn(),
  List: vi.fn(),
}));
const preset = {
  code: 'saved_' + 'a'.repeat(32),
  name: 'Work mail',
  authKinds: [AuthKind.AuthPassword],
  endpoints: [
    {
      protocol: Protocol.ProtocolIMAP,
      host: 'imap.example.invalid',
      port: 993,
      tlsMode: TLSMode.TLSImplicit,
    },
    {
      protocol: Protocol.ProtocolSMTP,
      host: 'smtp.example.invalid',
      port: 587,
      tlsMode: TLSMode.TLSStartTLS,
    },
  ],
};
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
it.each([
  null,
  [],
  {},
  { ...preset, code: 'gmail' },
  { ...preset, authKinds: ['oauth2'] },
  { ...preset, name: '\nprivate' },
  { ...preset, name: 'x'.repeat(129) },
  { ...preset, name: ' name ' },
  {
    ...preset,
    endpoints: preset.endpoints.map((endpoint) => ({ ...endpoint, host: 'mail\u0000.invalid' })),
  },
  { ...preset, endpoints: [preset.endpoints[0], preset.endpoints[0]] },
  { ...preset, endpoints: preset.endpoints.map((endpoint) => ({ ...endpoint, port: 65536 })) },
])('拒绝不可信预设 %#', (value) => expect(isSavedProvider(value)).toBe(false));
it('真实返回值转换为可复用预设；拒绝重复代码', async () => {
  vi.mocked(List).mockReturnValue(new CancellablePromise((resolve) => resolve([preset])));
  await expect(listCustomProviders()).resolves.toEqual([preset]);
  vi.mocked(List).mockReturnValue(new CancellablePromise((resolve) => resolve([preset, preset])));
  await expect(listCustomProviders()).rejects.toThrow('PROVIDER_STORAGE_FAILED');
});
it('创建仅传递服务器配置，保留安全业务码而不是底层诊断', async () => {
  const input = {
    name: 'Work mail',
    imap: { host: 'imap.example.invalid', port: 993, tlsMode: TLSMode.TLSImplicit },
    smtp: { host: 'smtp.example.invalid', port: 587, tlsMode: TLSMode.TLSStartTLS },
  };
  vi.mocked(Create).mockReturnValue(new CancellablePromise((resolve) => resolve(preset)));
  await expect(createCustomProvider(input)).resolves.toEqual(preset);
  expect(Create).toHaveBeenCalledWith(input);
  vi.mocked(Create).mockReturnValue(
    new CancellablePromise((_, reject) => reject(new Error('PROVIDER_NAME_EXISTS private-host'))),
  );
  await expect(createCustomProvider(input)).rejects.toThrow(/^PROVIDER_NAME_EXISTS$/);
});
it('超时与显式取消释放 IPC 和计时器，非桌面不创建调用', async () => {
  vi.useFakeTimers();
  vi.mocked(List).mockReturnValue(new CancellablePromise(() => {}));
  const timeout = expect(listCustomProviders()).rejects.toThrow('PROVIDER_STORAGE_FAILED');
  await vi.advanceTimersByTimeAsync(10_000);
  await timeout;
  expect(vi.getTimerCount()).toBe(0);
  const controller = new AbortController();
  controller.abort();
  await expect(listCustomProviders(controller.signal)).rejects.toThrow('PROVIDER_STORAGE_FAILED');
  vi.mocked(System.IsDesktop).mockReturnValueOnce(false);
  vi.mocked(List).mockClear();
  await expect(listCustomProviders()).rejects.toThrow('PROVIDER_STORAGE_FAILED');
  expect(List).not.toHaveBeenCalled();
});
