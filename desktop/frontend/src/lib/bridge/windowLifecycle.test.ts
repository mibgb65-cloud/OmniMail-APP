import { CancellablePromise } from '@wailsio/runtime/cancellable';
import { Events } from '@wailsio/runtime';
import { afterEach, expect, it, vi } from 'vitest';
import {
  State,
  SetMode,
  Resolve,
  Cancel,
} from '../../../bindings/omnimail/desktop/internal/bridge/windowlifecyclebridge';
import { supportsWindowControls } from './window';
import {
  cancelWindowClose,
  getWindowCloseState,
  isWindowCloseState,
  resolveWindowClose,
  setCloseMode,
  subscribeWindowClose,
} from './windowLifecycle';
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/windowlifecyclebridge', () => ({
  State: vi.fn(),
  SetMode: vi.fn(),
  Resolve: vi.fn(),
  Cancel: vi.fn(),
}));
vi.mock('./window', () => ({ supportsWindowControls: vi.fn(() => true) }));
vi.mock('@wailsio/runtime', () => ({ Events: { On: vi.fn() } }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
const state = { mode: 'ask', pending: true, backgroundAvailable: true };

it.each([
  null,
  [],
  {},
  { ...state, mode: 'exit' },
  { ...state, pending: 1 },
  { ...state, backgroundAvailable: 'true' },
])('拒绝错误的关闭 DTO %#', (value) => expect(isWindowCloseState(value)).toBe(false));
it('桥接读写、取消与单次/记住参数均传递真实值', async () => {
  vi.mocked(State).mockReturnValue(new CancellablePromise((resolve) => resolve(state)));
  vi.mocked(SetMode).mockReturnValue(new CancellablePromise((resolve) => resolve()));
  vi.mocked(Resolve).mockReturnValue(new CancellablePromise((resolve) => resolve()));
  vi.mocked(Cancel).mockReturnValue(new CancellablePromise((resolve) => resolve()));
  await expect(getWindowCloseState()).resolves.toEqual(state);
  await setCloseMode('background');
  expect(SetMode).toHaveBeenCalledWith('background');
  await resolveWindowClose('quit', true);
  expect(Resolve).toHaveBeenCalledWith('quit', true);
  await cancelWindowClose();
  expect(Cancel).toHaveBeenCalledOnce();
});
it('超时取消 IPC，不泄漏底层诊断', async () => {
  vi.useFakeTimers();
  vi.mocked(State).mockReturnValue(new CancellablePromise(() => {}));
  const result = expect(getWindowCloseState()).rejects.toThrow('无法完成关闭设置操作');
  await vi.advanceTimersByTimeAsync(8_000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});
it('非桌面及预取消请求不调用本机服务', async () => {
  vi.mocked(supportsWindowControls).mockReturnValueOnce(false);
  await expect(getWindowCloseState()).rejects.toThrow('无法完成关闭设置操作');
  const controller = new AbortController();
  controller.abort();
  await expect(getWindowCloseState(controller.signal)).rejects.toThrow('无法完成关闭设置操作');
  expect(State).not.toHaveBeenCalled();
});
it('只消费主窗口原生事件，不信任其他事件来源或数据', () => {
  const off = vi.fn();
  vi.mocked(Events.On).mockReturnValue(off);
  const update = vi.fn();
  const unsubscribe = subscribeWindowClose(update);
  const callback = vi.mocked(Events.On).mock.calls[0]?.[1];
  if (!callback) throw new Error('未注册事件');
  callback({ sender: 'other', data: {}, name: 'omnimail:window-close-changed' });
  callback({ sender: 'main', data: { mode: 'quit' }, name: 'omnimail:window-close-changed' });
  expect(update).toHaveBeenCalledOnce();
  unsubscribe();
  expect(off).toHaveBeenCalledOnce();
});
