import { Events, System, Window } from '@wailsio/runtime';

export type WindowAction = 'minimize' | 'maximize' | 'close';
const WINDOW_TIMEOUT = 3_000;
const operations = {
  minimize: () => Window.Minimise(),
  maximize: () => Window.ToggleMaximise(),
  close: () => Window.Close(),
};

export function supportsWindowControls(): boolean {
  return System.IsDesktop();
}

async function callWindow<T>(operation: () => Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!supportsWindowControls()) throw new Error('非桌面环境');
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('窗口调用超时')), WINDOW_TIMEOUT);
      }),
    ]);
  } catch {
    // 不透出原始运行时错误；UI 只展示可翻译的安全提示。
    throw new Error('窗口操作暂时不可用');
  } finally {
    clearTimeout(timeout);
  }
}

export async function readWindowMaximised(): Promise<boolean> {
  const value: unknown = await callWindow(() => Window.IsMaximised());
  if (typeof value !== 'boolean') throw new Error('窗口状态格式无效');
  return value;
}

export async function performWindowAction(action: WindowAction): Promise<void> {
  if (!Object.hasOwn(operations, action)) throw new Error('不支持的窗口操作');
  await callWindow(operations[action]);
}

export function subscribeWindowState(onChange: () => void): () => void {
  if (!supportsWindowControls()) return () => {};
  const names = [
    Events.Types.Common.WindowMaximise,
    Events.Types.Common.WindowUnMaximise,
    Events.Types.Common.WindowRestore,
  ];
  const unsubscribe = names.map((name) =>
    Events.On(name, (event) => {
      // beta.34 的原生窗口事件只分发到当前 WebView，sender 为空；显式指定
      // 其他窗口的自定义事件仍需忽略，且不消费事件中的任意 data。
      if (event.sender === undefined || event.sender === '' || event.sender === 'main') onChange();
    }),
  );
  return () => unsubscribe.forEach((off) => off());
}
