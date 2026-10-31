import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import * as api from '../lib/bridge/mail';
import { useMailActions } from './useMailActions';

vi.mock('../lib/bridge/mail', () => ({ setRead: vi.fn(), moveMessage: vi.fn() }));
const a: api.MailSummary = {
  id: 'a',
  accountId: 'account',
  mailbox: 'INBOX',
  subject: '测试',
  from: 'a@example.invalid',
  to: 'b@example.invalid',
  receivedAt: 1,
  read: false,
  starred: false,
  cached: true,
};

it('远端成功才标记已读，重复点击串行，失败保留原状态并反馈', async () => {
  let resolve: () => void = () => {};
  vi.mocked(api.setRead).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const base = [a],
    refresh = vi.fn();
  const { result } = renderHook(() => useMailActions('scope', base, refresh, vi.fn()));
  let task: Promise<void> | undefined;
  act(() => {
    task = result.current.runAction('read', base);
  });
  expect(result.current.messages[0]?.read).toBe(false);
  expect(result.current.actionBusy).toBe(true);
  await act(async () => {
    await result.current.runAction('read', base);
  });
  expect(api.setRead).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve();
    await task;
  });
  expect(result.current.messages[0]?.read).toBe(true);
  vi.mocked(api.setRead).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  await act(async () => {
    await result.current.runAction('read', result.current.messages);
  });
  expect(result.current.actionError).toBeInstanceOf(Error);
  expect(result.current.messages[0]?.read).toBe(true);
});

it('批量部分成功保留，切换范围停止剩余请求且不清理新选择', async () => {
  const base = [a, { ...a, id: 'b' }],
    refresh = vi.fn(),
    unselect = vi.fn();
  vi.mocked(api.setRead)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  const view = renderHook(({ scope }) => useMailActions(scope, base, refresh, unselect), {
    initialProps: { scope: 'a' },
  });
  await act(async () => {
    await view.result.current.runAction('allRead', base);
  });
  expect(view.result.current.messages.map((m) => m.read)).toEqual([true, false]);
  let resolve: () => void = () => {};
  vi.mocked(api.moveMessage).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  let task: Promise<void> | undefined;
  act(() => {
    task = view.result.current.runAction('deleted', base);
  });
  view.rerender({ scope: 'b' });
  await act(async () => {
    resolve();
    await task;
  });
  expect(unselect).not.toHaveBeenCalled();
  expect(view.result.current.actionError).toBeUndefined();
});

it('阅读通知显式写入已读，成功才更新列表，失败不自动重试或吞掉正文阅读错误', async () => {
  const base = [a],
    refresh = vi.fn();
  vi.mocked(api.setRead).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  const view = renderHook(() => useMailActions('scope', base, refresh, vi.fn(), 'a'));
  expect(api.setRead).not.toHaveBeenCalled();
  await act(async () => {
    view.result.current.markViewed('a');
  });
  expect(api.setRead).toHaveBeenCalledExactlyOnceWith('a', true);
  expect(view.result.current.messages[0]?.read).toBe(false);
  expect(view.result.current.autoReadError).toBeInstanceOf(Error);
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.setRead).toHaveBeenCalledTimes(1);
  vi.mocked(api.setRead).mockResolvedValueOnce(undefined);
  await act(async () => {
    await view.result.current.runAction('read', base);
  });
  expect(view.result.current.messages[0]?.read).toBe(true);
  expect(view.result.current.autoReadError).toBeUndefined();
});

it('操作忙碌时仅保留最新当前阅读目标，切走的待处理邮件不写入', async () => {
  const base = [a, { ...a, id: 'b' }, { ...a, id: 'c' }];
  let resolve: () => void = () => {};
  vi.mocked(api.setRead)
    .mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(undefined);
  const view = renderHook(
    ({ selected }) => useMailActions('scope', base, vi.fn(), vi.fn(), selected),
    { initialProps: { selected: 'a' } },
  );
  let task: Promise<void> | undefined;
  act(() => {
    task = view.result.current.runAction('read', [a]);
  });
  view.rerender({ selected: 'b' });
  act(() => view.result.current.markViewed('b'));
  view.rerender({ selected: 'c' });
  act(() => view.result.current.markViewed('c'));
  await act(async () => {
    resolve();
    await task;
  });
  expect(vi.mocked(api.setRead).mock.calls.map(([id]) => id)).toEqual(['a', 'c']);
});

it('已读或非法阅读目标不重复写入，手动未读不会被已排队的自动标记覆盖', async () => {
  let resolve: () => void = () => {};
  const base = [a];
  vi.mocked(api.setRead).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const view = renderHook(() => useMailActions('scope', base, vi.fn(), vi.fn(), 'a'));
  let task: Promise<void> | undefined;
  act(() => {
    task = view.result.current.runAction('read', [{ ...a, read: true }]);
  });
  act(() => view.result.current.markViewed('a'));
  await act(async () => {
    resolve();
    await task;
  });
  expect(api.setRead).toHaveBeenCalledExactlyOnceWith('a', false);
  expect(view.result.current.messages[0]?.read).toBe(false);
  act(() => view.result.current.markViewed('../bad'));
  expect(api.setRead).toHaveBeenCalledTimes(1);
});

it('正文尚未显示前手动标为未读，同次阅读稍后就绪也不能自动改回', async () => {
  const base = [{ ...a, read: true }];
  vi.mocked(api.setRead).mockResolvedValue(undefined);
  const view = renderHook(() => useMailActions('scope', base, vi.fn(), vi.fn(), 'a'));
  await act(async () => {
    await view.result.current.runAction('read', base);
  });
  await act(async () => {
    view.result.current.markViewed('a');
  });
  expect(api.setRead).toHaveBeenCalledExactlyOnceWith('a', false);
});

it('已经已读不发请求，账号范围变化丢弃旧阅读通知', async () => {
  const base = [{ ...a, read: true }];
  const view = renderHook(({ scope }) => useMailActions(scope, base, vi.fn(), vi.fn(), 'a'), {
    initialProps: { scope: 'first' },
  });
  const stale = view.result.current.markViewed;
  await act(async () => view.result.current.markViewed('a'));
  expect(api.setRead).not.toHaveBeenCalled();
  view.rerender({ scope: 'second' });
  await act(async () => stale('a'));
  expect(api.setRead).not.toHaveBeenCalled();
});
