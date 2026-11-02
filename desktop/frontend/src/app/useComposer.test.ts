import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../lib/bridge/mail';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import { useComposer } from './useComposer';

vi.mock('../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../lib/bridge/mail')>()),
  send: vi.fn(),
}));
const account = (id: string): api.AccountSummary => ({
  id,
  providerCode: 'custom',
  email: `${id}@example.invalid`,
  displayName: id,
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
});
const first = account('first');
const accounts = [first, account('second')];
beforeEach(() => {
  vi.mocked(api.send).mockReset().mockResolvedValue(undefined);
});
it('多账号不默认第一项，当前账号可用才预选；返回浏览后保留内容和发件人', () => {
  const { result } = renderHook(() => useComposer(accounts, vi.fn()));
  act(() => result.current.open(''));
  expect(result.current.session?.accountId).toBe('');
  act(() => result.current.open('second'));
  expect(result.current.session?.accountId).toBe('');
  act(() => result.current.update('accountId', 'second'));
  act(() => result.current.update('body', '本次会话内容'));
  act(() => result.current.hide());
  expect(result.current.visible).toBe(false);
  act(() => result.current.open('first'));
  expect(result.current.visible).toBe(true);
  expect(result.current.session?.body).toBe('本次会话内容');
  expect(result.current.session?.accountId).toBe('second');
});
it('当前账号失效不偷换发件人，发送前重新检查账号；仅单账号的全部视图可默认', async () => {
  const { result, rerender } = renderHook(({ values }) => useComposer(values, vi.fn()), {
    initialProps: { values: [first] },
  });
  act(() => result.current.open('unavailable'));
  expect(result.current.session?.accountId).toBe('');
  act(() => result.current.discard());
  act(() => result.current.open(''));
  expect(result.current.session?.accountId).toBe('first');
  act(() => result.current.update('to', 'recipient@example.invalid'));
  act(() => result.current.update('subject', '主题'));
  act(() => result.current.update('body', '正文'));
  rerender({ values: [{ ...first, status: AccountStatus.AccountDisconnected }] });
  await act(async () => result.current.requestSend());
  expect(api.send).not.toHaveBeenCalled();
  expect(result.current.invalidField).toBe('accountId');
});
it('同步提交锁防重复发送，临时返回不取消发送，服务器接受后只通知一次', async () => {
  let finish = () => {};
  vi.mocked(api.send).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const sent = vi.fn();
  const { result } = renderHook(() => useComposer(accounts, sent));
  act(() => result.current.open('first'));
  act(() => result.current.update('to', 'recipient@example.invalid'));
  act(() => result.current.update('subject', '主题'));
  act(() => result.current.update('body', '正文'));
  act(() => {
    void result.current.requestSend();
    void result.current.requestSend();
  });
  expect(api.send).toHaveBeenCalledOnce();
  act(() => result.current.hide());
  const signal = vi.mocked(api.send).mock.calls[0]?.[1];
  expect(signal?.aborted).toBe(false);
  act(() => result.current.discard());
  expect(result.current.session?.status).toBe('sending');
  await act(async () => finish());
  expect(result.current.session?.status).toBe('sent');
  expect(sent).toHaveBeenCalledOnce();
});
it('空主题正文先确认，发送不确定后保留内容且不能直接重发', async () => {
  vi.mocked(api.send).mockRejectedValue(new Error('SEND_UNCERTAIN'));
  const { result } = renderHook(() => useComposer(accounts, vi.fn()));
  act(() => result.current.open('first'));
  act(() => result.current.update('to', 'recipient@example.invalid'));
  await act(async () => result.current.requestSend());
  expect(result.current.confirmation?.kind).toBe('empty');
  expect(api.send).not.toHaveBeenCalled();
  await act(async () => result.current.confirmSend());
  expect(result.current.session?.status).toBe('uncertain');
  expect(result.current.session?.to).toBe('recipient@example.invalid');
  await act(async () => result.current.requestSend());
  expect(api.send).toHaveBeenCalledOnce();
  act(() => result.current.discard());
  expect(result.current.confirmation?.kind).toBe('discard');
  act(() => result.current.cancelConfirmation());
  expect(result.current.session?.status).toBe('uncertain');
});
it('放弃与返回分离，确认放弃才清空；普通失败保留正文可修正重试', async () => {
  vi.mocked(api.send).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  const { result } = renderHook(() => useComposer(accounts, vi.fn()));
  act(() => result.current.open('first'));
  act(() => result.current.update('to', 'recipient@example.invalid'));
  act(() => result.current.update('subject', '主题'));
  act(() => result.current.update('body', '保留正文'));
  await act(async () => result.current.requestSend());
  expect(result.current.session?.status).toBe('editing');
  expect(result.current.session?.body).toBe('保留正文');
  act(() => result.current.discard());
  expect(result.current.session).not.toBeNull();
  act(() => result.current.confirmDiscard());
  expect(result.current.session).toBeNull();
  expect(result.current.visible).toBe(false);
});

it.each(['CANCELED', 'TIMEOUT', 'BRIDGE_UNAVAILABLE'])(
  '桥接无法确认结果（%s）时也锁定直接重发',
  async (code) => {
    vi.mocked(api.send).mockRejectedValue(new Error(code));
    const { result } = renderHook(() => useComposer(accounts, vi.fn()));
    act(() => result.current.open('first'));
    act(() => result.current.update('to', 'recipient@example.invalid'));
    act(() => result.current.update('subject', '主题'));
    act(() => result.current.update('body', '正文'));
    await act(async () => result.current.requestSend());
    expect(result.current.session?.status).toBe('uncertain');
    expect(api.errorCode(result.current.session?.error)).toBe('SEND_UNCERTAIN');
    await act(async () => result.current.requestSend());
    expect(api.send).toHaveBeenCalledOnce();
  },
);
