import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  performWindowAction,
  readWindowMaximised,
  subscribeWindowState,
  type WindowAction,
} from './window';

const runtime = vi.hoisted(() => ({
  desktop: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
  readMaximised: vi.fn(),
  on: vi.fn(),
}));

vi.mock('@wailsio/runtime', () => ({
  System: { IsDesktop: runtime.desktop },
  Window: {
    Minimise: runtime.minimize,
    ToggleMaximise: runtime.maximize,
    Close: runtime.close,
    IsMaximised: runtime.readMaximised,
  },
  Events: {
    On: runtime.on,
    Types: {
      Common: {
        WindowMaximise: 'common:WindowMaximise',
        WindowUnMaximise: 'common:WindowUnMaximise',
        WindowRestore: 'common:WindowRestore',
      },
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  runtime.desktop.mockReturnValue(true);
});
afterEach(() => vi.useRealTimers());

describe('窗口运行时适配', () => {
  it.each([
    ['minimize', runtime.minimize],
    ['maximize', runtime.maximize],
    ['close', runtime.close],
  ] as const)('将 %s 映射到当前 Wails 版本的实际 API', async (action, operation) => {
    operation.mockResolvedValue(undefined);
    await performWindowAction(action);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('读取最大化状态，并拒绝运行时返回的非布尔值', async () => {
    runtime.readMaximised.mockResolvedValueOnce(true).mockResolvedValueOnce('true');
    expect(await readWindowMaximised()).toBe(true);
    await expect(readWindowMaximised()).rejects.toThrow('窗口状态格式无效');
  });

  it('浏览器预览不调用桌面 API、不注册原生事件', async () => {
    runtime.desktop.mockReturnValue(false);
    await expect(performWindowAction('close')).rejects.toThrow('窗口操作暂时不可用');
    subscribeWindowState(vi.fn())();
    expect(runtime.close).not.toHaveBeenCalled();
    expect(runtime.on).not.toHaveBeenCalled();
  });

  it('拒绝白名单以外的操作', async () => {
    await expect(performWindowAction('__proto__' as WindowAction)).rejects.toThrow('不支持');
    expect(runtime.close).not.toHaveBeenCalled();
  });

  it('底层异常被安全映射，不泄露敏感诊断', async () => {
    runtime.maximize.mockRejectedValue(new Error('token=private'));
    await expect(performWindowAction('maximize')).rejects.toThrow(/^窗口操作暂时不可用$/);
  });

  it('原生调用超时后恢复控制权并清理计时器', async () => {
    vi.useFakeTimers();
    runtime.maximize.mockReturnValue(new Promise(() => {}));
    const assertion = expect(performWindowAction('maximize')).rejects.toThrow('窗口操作暂时不可用');
    await vi.advanceTimersByTimeAsync(3_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('只处理主窗口事件，并准确移除订阅', () => {
    const off = vi.fn();
    runtime.on.mockReturnValue(off);
    const change = vi.fn();
    const unsubscribe = subscribeWindowState(change);
    expect(runtime.on).toHaveBeenCalledTimes(3);
    for (const [, callback] of runtime.on.mock.calls) {
      callback({ sender: 'other' });
      callback({ sender: 'main' });
    }
    expect(change).toHaveBeenCalledTimes(3);
    unsubscribe();
    expect(off).toHaveBeenCalledTimes(3);
  });

  it('当前窗口原生事件未携带 sender 时仍刷新状态', () => {
    runtime.on.mockReturnValue(vi.fn());
    const change = vi.fn();
    subscribeWindowState(change);
    for (const [, callback] of runtime.on.mock.calls) {
      callback({});
      callback({ sender: '' });
    }
    expect(change).toHaveBeenCalledTimes(6);
  });
});
