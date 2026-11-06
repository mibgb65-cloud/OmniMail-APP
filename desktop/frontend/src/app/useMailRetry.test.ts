import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../lib/bridge/mail';
import { useMail } from './useMail';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  accounts: vi.fn(),
  messages: vi.fn().mockResolvedValue([]),
  synchronize: vi.fn(),
}));
const account: api.AccountSummary = {
  id: 'account-test',
  providerCode: 'qq',
  email: 'work@example.invalid',
  displayName: '',
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: 'NETWORK_FAILED', lastSyncAt: 0 },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.accounts).mockResolvedValue([account]);
});
it('定向重试失败邮箱，不切换账号或清空当前筛选；排队成功立即标记同步中', async () => {
  vi.mocked(api.synchronize).mockResolvedValue(undefined);
  const { result } = renderHook(() => useMail('inbox'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.setFilter('保留筛选'));
  await act(() => result.current.retryAccount(account.id));
  expect(api.synchronize).toHaveBeenCalledExactlyOnceWith(account.id);
  expect(result.current.accountId).toBe('');
  expect(result.current.filter).toBe('保留筛选');
  expect(result.current.accounts[0]?.sync.running).toBe(true);
  expect(result.current.accounts[0]?.sync.errorCode).toBe('');
});
it('重试失败向调用方传播，BUSY 按已排队处理，未知账号不能发起同步', async () => {
  const { result } = renderHook(() => useMail('inbox'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  vi.mocked(api.synchronize).mockRejectedValueOnce(new Error('TIMEOUT'));
  await act(async () => {
    await expect(result.current.retryAccount(account.id)).rejects.toThrow('TIMEOUT');
  });
  expect(result.current.accounts[0]?.sync.running).toBe(false);
  vi.mocked(api.synchronize).mockRejectedValueOnce(new Error('BUSY'));
  await act(() => result.current.retryAccount(account.id));
  expect(result.current.accounts[0]?.sync.running).toBe(true);
  await expect(result.current.retryAccount('unknown')).rejects.toThrow('INVALID_INPUT');
  expect(api.synchronize).toHaveBeenCalledTimes(2);
});

it('工具栏同步请求失败也落在侧栏账号状态，不变成列表顶部账号读取错误', async () => {
  vi.mocked(api.accounts).mockResolvedValue([
    { ...account, sync: { ...account.sync, errorCode: '' } },
  ]);
  vi.mocked(api.synchronize).mockRejectedValueOnce(new Error('TIMEOUT private-marker'));
  const { result } = renderHook(() => useMail('inbox'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(() => result.current.sync());
  expect(result.current.error).toBeUndefined();
  expect(result.current.accounts[0]?.sync.errorCode).toBe('TIMEOUT');
  expect(result.current.syncRequested).toBe(false);
});
