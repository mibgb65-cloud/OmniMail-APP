import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  getWindowCloseState,
  subscribeWindowClose,
  type WindowCloseState,
} from '../bridge/windowLifecycle';
import { useWindowCloseState } from './useWindowCloseState';
vi.mock('../bridge/window', () => ({ supportsWindowControls: () => true }));
vi.mock('../bridge/windowLifecycle', () => ({
  getWindowCloseState: vi.fn(),
  subscribeWindowClose: vi.fn(),
}));
const initial: WindowCloseState = { mode: 'ask', pending: false, backgroundAvailable: true };
let notify: () => void = () => {};
const unsubscribe = vi.fn();
beforeEach(() => {
  vi.mocked(getWindowCloseState).mockReset().mockResolvedValue(initial);
  unsubscribe.mockClear();
  vi.mocked(subscribeWindowClose).mockImplementation((callback) => {
    notify = callback;
    return unsubscribe;
  });
});
it('启动恢复前端加载前的待确认状态，事件更新不创建第二份请求', async () => {
  vi.mocked(getWindowCloseState).mockResolvedValue({ ...initial, pending: true });
  const view = renderHook(useWindowCloseState);
  await waitFor(() => expect(view.result.current.state.value?.pending).toBe(true));
  vi.mocked(getWindowCloseState).mockResolvedValue(initial);
  act(() => notify());
  await waitFor(() => expect(view.result.current.state.value?.pending).toBe(false));
  const signal = vi.mocked(getWindowCloseState).mock.calls[0]?.[0];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it('过期结果不能覆盖新快照，读取失败保留已展示的待确认窗口', async () => {
  let finish: (value: WindowCloseState) => void = () => {};
  vi.mocked(getWindowCloseState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = renderHook(useWindowCloseState);
  vi.mocked(getWindowCloseState).mockResolvedValue({ ...initial, pending: true });
  act(() => notify());
  await waitFor(() => expect(view.result.current.state.value?.pending).toBe(true));
  await act(async () => finish(initial));
  expect(view.result.current.state.value?.pending).toBe(true);
  vi.mocked(getWindowCloseState).mockRejectedValue(new Error('private'));
  act(() => notify());
  await waitFor(() => expect(view.result.current.state.status).toBe('error'));
  expect(view.result.current.state.value?.pending).toBe(true);
});
