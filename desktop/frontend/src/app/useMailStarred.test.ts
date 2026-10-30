import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import * as api from '../lib/bridge/mail';
import { useMailStarred } from './useMailStarred';

vi.mock('../lib/bridge/mail', () => ({ setStarred: vi.fn() }));
const message: api.MailSummary = {
  id: 'test-id',
  accountId: 'account',
  mailbox: 'INBOX',
  subject: '脱敏测试',
  from: 'from@example.invalid',
  to: 'to@example.invalid',
  receivedAt: 1,
  read: false,
  starred: false,
  cached: true,
};

it('成功后重读列表，失败不伪造成功；星标分类取消时清理阅读选择', async () => {
  const refresh = vi.fn(),
    unselect = vi.fn();
  vi.mocked(api.setStarred).mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useMailStarred('scope', 'starred', unselect, refresh));
  await act(async () => {
    await result.current.toggleStarred({ ...message, starred: true });
  });
  expect(api.setStarred).toHaveBeenCalledWith(message.id, false);
  expect(refresh).toHaveBeenCalledOnce();
  expect(unselect).toHaveBeenCalledOnce();
  vi.mocked(api.setStarred).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  await act(async () => {
    await result.current.toggleStarred(message);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(result.current.starError).toBeInstanceOf(Error);
});

it('跨范围的旧请求保持写操作串行，完成后释放按钮且不污染新范围错误', async () => {
  let resolve: () => void = () => {};
  vi.mocked(api.setStarred).mockReturnValueOnce(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const { result, rerender } = renderHook(
    ({ scope }) => useMailStarred(scope, 'inbox', vi.fn(), vi.fn()),
    { initialProps: { scope: 'a' } },
  );
  act(() => {
    void result.current.toggleStarred(message);
  });
  expect(result.current.starPending).toBe(message.id);
  rerender({ scope: 'b' });
  expect(result.current.starPending).toBe(message.id);
  await act(async () => resolve());
  expect(result.current.starPending).toBe('');
  expect(result.current.starError).toBeUndefined();
});

it.each([
  [message.id, 'another', 'another'],
  ['another', message.id, ''],
])('取消星标完成时按最新选择清理阅读器，而不是请求开始时的 %s', async (initial, next, expected) => {
  let resolve: () => void = () => {};
  vi.mocked(api.setStarred).mockReturnValueOnce(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const { result } = renderHook(() => {
    const [selected, setSelected] = useState(initial);
    const stars = useMailStarred(
      'scope',
      'starred',
      (id) => setSelected((current) => (current === id ? '' : current)),
      vi.fn(),
    );
    return { ...stars, selected, setSelected };
  });
  act(() => {
    void result.current.toggleStarred({ ...message, starred: true });
  });
  act(() => result.current.setSelected(next));
  await act(async () => resolve());
  expect(result.current.selected).toBe(expected);
});
it('星标立即显示期望值，不同邮件独立保存，旧同步快照不闪回且失败只回滚该邮件', async () => {
  let first: () => void = () => {};
  let fail: (error: unknown) => void = () => {};
  vi.mocked(api.setStarred)
    .mockReturnValueOnce(
      new Promise<void>((done) => {
        first = done;
      }),
    )
    .mockReturnValueOnce(
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
    );
  const other = { ...message, id: 'other-id' };
  const base = [message, other];
  const { result, rerender } = renderHook(
    ({ messages }) => useMailStarred('scope', 'inbox', vi.fn(), vi.fn(), messages),
    { initialProps: { messages: base } },
  );
  act(() => {
    void result.current.toggleStarred(message);
  });
  expect(result.current.messages[0]?.starred).toBe(true);
  act(() => {
    void result.current.toggleStarred(other);
  });
  expect(api.setStarred).toHaveBeenCalledTimes(2);
  expect(result.current.isStarPending(message.id)).toBe(true);
  expect(result.current.isStarPending(other.id)).toBe(true);
  rerender({ messages: [...base] });
  expect(result.current.messages.every((item) => item.starred)).toBe(true);
  await act(async () => first());
  expect(result.current.messages[0]?.starred).toBe(true);
  await act(async () => fail(new Error('NETWORK_FAILED')));
  expect(result.current.messages[0]?.starred).toBe(true);
  expect(result.current.messages[1]?.starred).toBe(false);
  rerender({ messages: [{ ...message, starred: true }, other] });
  rerender({ messages: base });
  expect(result.current.messages[0]?.starred).toBe(false);
});
it('切换星标分类时仍显示本账号尚在保存的星标，其他账号不串入', async () => {
  let resolve: () => void = () => {};
  vi.mocked(api.setStarred).mockReturnValueOnce(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const { result, rerender } = renderHook(
    ({ folder, accountId }: { folder: 'inbox' | 'starred'; accountId: string }) =>
      useMailStarred(JSON.stringify([accountId, folder]), folder, vi.fn(), vi.fn(), [], accountId),
    { initialProps: { folder: 'inbox', accountId: message.accountId } },
  );
  act(() => {
    void result.current.toggleStarred(message);
  });
  rerender({ folder: 'starred', accountId: message.accountId });
  expect(result.current.messages[0]?.id).toBe(message.id);
  expect(result.current.messages[0]?.starred).toBe(true);
  rerender({ folder: 'starred', accountId: 'other-account' });
  expect(result.current.messages).toHaveLength(0);
  await act(async () => resolve());
});
