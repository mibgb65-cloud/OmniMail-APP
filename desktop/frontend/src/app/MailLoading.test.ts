import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../lib/bridge/mail';
import { useMail } from './useMail';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  accounts: vi.fn(),
  messages: vi.fn(),
  message: vi.fn(),
}));
const summary: api.MailSummary = {
  id: 'mail-test',
  accountId: 'account-test',
  mailbox: 'INBOX',
  subject: '测试摘要',
  from: 'from@example.invalid',
  to: 'to@example.invalid',
  receivedAt: 1,
  read: false,
  starred: false,
  cached: false,
};
const account: api.AccountSummary = {
  id: 'account-test',
  providerCode: 'custom',
  email: 'work@example.invalid',
  displayName: '工作邮箱',
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
};
const detail: api.MailDetail = {
  ...summary,
  cached: true,
  body: '按需加载的正文',
  attachments: [],
};
const flush = async () =>
  act(async () => {
    await Promise.resolve();
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(api.accounts).mockResolvedValue([account]);
  vi.mocked(api.messages).mockResolvedValue([summary]);
});
afterEach(() => vi.useRealTimers());

it('账号状态轮询暂时失败仍保留已经加载的邮件，不退回演示空态', async () => {
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  expect(result.current.messages).toHaveLength(1);
  vi.mocked(api.accounts).mockRejectedValue(new Error('NETWORK_FAILED private-marker'));
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(result.current.ready).toBe(true);
  expect(result.current.messages).toHaveLength(1);
  expect(api.errorCode(result.current.error)).toBe('NETWORK_FAILED');
});

it('正文遇到账号 BUSY 时显示等待并自动恢复，而不是让用户停留在错误页', async () => {
  vi.mocked(api.message).mockRejectedValueOnce(new Error('BUSY')).mockResolvedValue(detail);
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setSelected(summary.id));
  await flush();
  expect(result.current.bodyWaiting).toBe(true);
  expect(result.current.bodyError).toBeUndefined();
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(result.current.detail?.body).toBe(detail.body);
  expect(result.current.bodyWaiting).toBe(false);
});

it('正文网络失败不循环重试，手动重试立即清掉旧错误并显示加载', async () => {
  vi.mocked(api.message).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setSelected(summary.id));
  await flush();
  await act(async () => vi.advanceTimersByTimeAsync(9000));
  expect(api.message).toHaveBeenCalledOnce();
  let resolve: (value: api.MailDetail) => void = () => {};
  vi.mocked(api.message).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  act(() => result.current.retryBody());
  expect(result.current.loading).toBe(true);
  expect(result.current.bodyError).toBeUndefined();
  await act(async () => resolve(detail));
  expect(result.current.detail?.body).toBe(detail.body);
});

it('持续 BUSY 的自动重试有界，之后保留可操作错误而不无限请求', async () => {
  vi.mocked(api.message).mockRejectedValue(new Error('BUSY'));
  const { result } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setSelected(summary.id));
  await flush();
  await act(async () => vi.advanceTimersByTimeAsync(90_000));
  expect(result.current.bodyWaiting).toBe(false);
  expect(api.errorCode(result.current.bodyError)).toBe('BUSY');
  const count = vi.mocked(api.message).mock.calls.length;
  expect(count).toBeGreaterThan(1);
  expect(count).toBeLessThan(50);
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(api.message).toHaveBeenCalledTimes(count);
});

it('切换邮件或卸载会取消 BUSY 重试，旧正文不能覆盖新选择', async () => {
  vi.mocked(api.message)
    .mockRejectedValueOnce(new Error('BUSY'))
    .mockResolvedValue({
      ...detail,
      id: 'other-mail',
      body: '另一个正文',
    });
  const { result, unmount } = renderHook(() => useMail('inbox'));
  await flush();
  act(() => result.current.setSelected(summary.id));
  await flush();
  act(() => result.current.setSelected('other-mail'));
  await flush();
  await act(async () => vi.advanceTimersByTimeAsync(6000));
  expect(result.current.detail?.body).toBe('另一个正文');
  expect(api.message).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => vi.advanceTimersByTimeAsync(6000));
  expect(api.message).toHaveBeenCalledTimes(2);
});
