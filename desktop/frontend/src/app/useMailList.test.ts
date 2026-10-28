import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import * as api from '../lib/bridge/mail';
import { useMail } from './useMail';
import { useMailList, type MailListQuery } from './useMailList';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  accounts: vi.fn(),
  messages: vi.fn(),
  message: vi.fn(),
}));

function message(index: number): api.MailSummary {
  return {
    id: `mail-${index}`,
    accountId: 'account-a',
    mailbox: 'INBOX',
    subject: `主题 ${index}`,
    from: 'sender@example.invalid',
    to: 'person@example.invalid',
    receivedAt: 1_700_000_000_000 - index,
    read: false,
    starred: false,
    cached: true,
  };
}
const batch = (start: number, count = 100) =>
  Array.from({ length: count }, (_, i) => message(start + i));
const initial: MailListQuery = {
  ready: true,
  accountId: 'account-a',
  folder: 'inbox',
  revision: 0,
  viewRevision: 0,
  syncStamp: 'first',
};
function deferred<T>() {
  let complete: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      if (!complete) throw new Error('测试 Promise 尚未初始化');
      complete(value);
    },
  };
}
const renderList = () =>
  renderHook((query: MailListQuery) => useMailList(query), { initialProps: initial });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.messages).mockReset();
  vi.mocked(api.messages).mockResolvedValue([]);
});

describe('邮件列表分批追加', () => {
  it('追加并按 ID 去重，按原始读取数推进，短批次后停止', async () => {
    vi.mocked(api.messages)
      .mockResolvedValueOnce(batch(0))
      .mockResolvedValueOnce(batch(99))
      .mockResolvedValueOnce(batch(199, 1));
    const { result } = renderList();
    await waitFor(() => expect(result.current.messages).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(199));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(200));
    expect(new Set(result.current.messages.map((value) => value.id)).size).toBe(200);
    expect(vi.mocked(api.messages).mock.calls.map((call) => call[2])).toEqual([0, 100, 200]);
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(api.messages).toHaveBeenCalledTimes(3);
  });

  it('请求未结束时重复触底只读取一次，不清空已有数据', async () => {
    const next = deferred<api.MailSummary[]>();
    vi.mocked(api.messages).mockResolvedValueOnce(batch(0)).mockReturnValueOnce(next.promise);
    const { result } = renderList();
    await waitFor(() => expect(result.current.messages).toHaveLength(100));
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(api.messages).toHaveBeenCalledTimes(2);
    expect(result.current.listLoading).toBe(true);
    expect(result.current.messages).toHaveLength(100);
    await act(async () => next.resolve(batch(100)));
    expect(result.current.messages).toHaveLength(200);
  });

  it('追加失败保留邮件并停止自动重试，显式重试同一偏移', async () => {
    vi.mocked(api.messages)
      .mockResolvedValueOnce(batch(0))
      .mockRejectedValueOnce(new Error('NETWORK_FAILED'))
      .mockResolvedValueOnce(batch(100, 3));
    const { result } = renderList();
    await waitFor(() => expect(result.current.messages).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.listError).toBeInstanceOf(Error));
    expect(result.current.messages).toHaveLength(100);
    act(() => result.current.loadMore());
    expect(api.messages).toHaveBeenCalledTimes(2);
    act(() => result.current.retryList());
    await waitFor(() => expect(result.current.messages).toHaveLength(103));
    expect(vi.mocked(api.messages).mock.calls.map((call) => call[2])).toEqual([0, 100, 100]);
    expect(result.current.listError).toBeUndefined();
  });

  it('首次失败可以重试首批，空列表没有可加载的下一批', async () => {
    vi.mocked(api.messages)
      .mockRejectedValueOnce(new Error('STORAGE_FAILED'))
      .mockResolvedValueOnce([]);
    const { result } = renderList();
    await waitFor(() => expect(result.current.listError).toBeInstanceOf(Error));
    act(() => result.current.retryList());
    await waitFor(() => expect(result.current.listError).toBeUndefined());
    expect(result.current.listLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(vi.mocked(api.messages).mock.calls.map((call) => call[2])).toEqual([0, 0]);
  });

  it.each(['folder', 'accountId', 'viewRevision'] as const)(
    '改变 %s 取消旧请求并从首批开始',
    async (field) => {
      const next = deferred<api.MailSummary[]>();
      vi.mocked(api.messages)
        .mockResolvedValueOnce(batch(0))
        .mockReturnValueOnce(next.promise)
        .mockResolvedValueOnce(batch(500, 2));
      const { result, rerender } = renderList();
      await waitFor(() => expect(result.current.messages).toHaveLength(100));
      act(() => result.current.loadMore());
      const oldSignal = vi.mocked(api.messages).mock.calls[1]?.[3];
      const oldKey = result.current.listKey;
      rerender({
        ...initial,
        [field]: field === 'folder' ? 'starred' : field === 'accountId' ? 'account-b' : 1,
      });
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      expect(oldSignal?.aborted).toBe(true);
      expect(result.current.listKey).not.toBe(oldKey);
      await act(async () => next.resolve(batch(100)));
      expect(result.current.messages.map((value) => value.id)).toEqual(['mail-500', 'mail-501']);
      expect(vi.mocked(api.messages).mock.calls[2]?.[2]).toBe(0);
    },
  );

  it('同步戳变化后原子重验全部已加载范围，不退回首批或最后一批', async () => {
    vi.mocked(api.messages).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce(batch(100));
    const { result, rerender } = renderList();
    await waitFor(() => expect(result.current.messages).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(200));
    const head = deferred<api.MailSummary[]>(),
      tail = deferred<api.MailSummary[]>();
    vi.mocked(api.messages).mockReturnValueOnce(head.promise).mockReturnValueOnce(tail.promise);
    const oldKey = result.current.listKey;
    rerender({ ...initial, syncStamp: 'updated' });
    expect(result.current.listLoading).toBe(true);
    expect(result.current.messages).toHaveLength(200);
    await act(async () => head.resolve([message(-1), ...batch(0, 99)]));
    expect(result.current.messages[0]?.id).toBe('mail-0');
    await act(async () => tail.resolve(batch(99)));
    expect(result.current.messages).toHaveLength(200);
    expect(result.current.messages[0]?.id).toBe('mail--1');
    expect(result.current.listKey).toBe(oldKey);
    expect(vi.mocked(api.messages).mock.calls.map((call) => call[2])).toEqual([0, 100, 0, 100]);
  });

  it('刷新中途失败不发布半个快照，重试仍读取已加载范围', async () => {
    vi.mocked(api.messages).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce(batch(100));
    const { result, rerender } = renderList();
    await waitFor(() => expect(result.current.messages).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(200));
    vi.mocked(api.messages)
      .mockResolvedValueOnce(batch(500))
      .mockRejectedValueOnce(new Error('STORAGE_FAILED'));
    rerender({ ...initial, revision: 1 });
    await waitFor(() => expect(result.current.listError).toBeInstanceOf(Error));
    expect(result.current.messages[0]?.id).toBe('mail-0');
    vi.mocked(api.messages).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce(batch(100));
    act(() => result.current.retryList());
    await waitFor(() => expect(result.current.listError).toBeUndefined());
    expect(result.current.messages).toHaveLength(200);
    expect(
      vi
        .mocked(api.messages)
        .mock.calls.slice(-2)
        .map((call) => call[2]),
    ).toEqual([0, 100]);
  });

  it('未连接时不读取，卸载会取消未完成的请求', async () => {
    const { result, rerender, unmount } = renderHook((query: MailListQuery) => useMailList(query), {
      initialProps: { ...initial, ready: false },
    });
    expect(api.messages).not.toHaveBeenCalled();
    expect(result.current.listLoading).toBe(false);
    vi.mocked(api.messages).mockReturnValue(new Promise(() => {}));
    rerender(initial);
    const signal = vi.mocked(api.messages).mock.calls[0]?.[3];
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it.each(['status', 'errorCode'] as const)(
    '账号 %s 变化即使同步时间未变也会刷新，普通轮询不会重读列表',
    async (field) => {
      vi.useFakeTimers();
      const account: api.AccountSummary = {
        id: 'account-a',
        providerCode: 'custom',
        email: 'person@example.invalid',
        displayName: '测试',
        status: AccountStatus.AccountConfigured,
        sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
      };
      vi.mocked(api.accounts).mockImplementation(async () => [
        { ...account, sync: { ...account.sync } },
      ]);
      vi.mocked(api.messages).mockResolvedValue(batch(0, 1));
      const { result, unmount } = renderHook(() => useMail('inbox'));
      try {
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.messages).toHaveLength(1);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });
        expect(api.messages).toHaveBeenCalledOnce();
        vi.mocked(api.accounts).mockResolvedValue([
          {
            ...account,
            status: field === 'status' ? AccountStatus.AccountDisconnected : account.status,
            sync: { ...account.sync, errorCode: field === 'errorCode' ? 'NETWORK_FAILED' : '' },
          },
        ]);
        vi.mocked(api.messages).mockResolvedValue(batch(500, 2));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });
        expect(result.current.messages).toHaveLength(2);
        expect(api.messages).toHaveBeenCalledTimes(2);
      } finally {
        unmount();
        vi.useRealTimers();
      }
    },
  );

  it('追加不会取消当前阅读项或重新请求正文', async () => {
    vi.mocked(api.accounts).mockResolvedValue([
      {
        id: 'account-a',
        providerCode: 'custom',
        email: 'person@example.invalid',
        displayName: '测试',
        status: AccountStatus.AccountConfigured,
        sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
      },
    ]);
    vi.mocked(api.messages).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce(batch(100, 2));
    vi.mocked(api.message).mockResolvedValue({ ...message(0), body: '正文', attachments: [] });
    const { result } = renderHook(() => useMail('inbox'));
    await waitFor(() => expect(result.current.messages).toHaveLength(100));
    act(() => result.current.setSelected('mail-0'));
    await waitFor(() => expect(result.current.detail?.body).toBe('正文'));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(102));
    expect(result.current.selected).toBe('mail-0');
    expect(result.current.detail?.body).toBe('正文');
    expect(api.message).toHaveBeenCalledOnce();
  });
});
