import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../lib/bridge/mail';
import { useMail } from './useMail';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  accounts: vi.fn(),
  messages: vi.fn().mockResolvedValue([]),
  disconnect: vi.fn(),
}));
const account: api.AccountSummary = {
  id: 'synthetic-account',
  email: 'work@example.invalid',
  displayName: '',
  providerCode: 'custom',
  status: AccountStatus.AccountConfigured,
  sync: { running: true, more: true, errorCode: '', lastSyncAt: 1 },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.accounts).mockResolvedValue([account]);
});
it('断开失败传播给管理窗，不误标成功或变成全局账号读取失败', async () => {
  vi.mocked(api.disconnect).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  const { result } = renderHook(() => useMail('inbox'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await expect(result.current.disconnectAccount(account.id)).rejects.toThrow('NETWORK_FAILED');
  });
  expect(result.current.error).toBeUndefined();
  expect(result.current.accounts[0]?.status).toBe(AccountStatus.AccountConfigured);
});
it('断开成功即时反映状态而不更改邮箱选择及筛选', async () => {
  vi.mocked(api.disconnect).mockImplementation(async () => {
    vi.mocked(api.accounts).mockResolvedValue([
      {
        ...account,
        status: AccountStatus.AccountDisconnected,
        sync: { ...account.sync, running: false, more: false },
      },
    ]);
  });
  const { result } = renderHook(() => useMail('inbox'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.setFilter('保留筛选'));
  await act(() => result.current.disconnectAccount(account.id));
  expect(result.current.accounts[0]?.status).toBe(AccountStatus.AccountDisconnected);
  expect(result.current.accounts[0]?.sync.running).toBe(false);
  expect(result.current.filter).toBe('保留筛选');
  expect(result.current.accountId).toBe('');
});
