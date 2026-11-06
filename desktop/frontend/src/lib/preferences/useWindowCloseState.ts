import { useEffect, useState } from 'react';
import {
  getWindowCloseState,
  subscribeWindowClose,
  type WindowCloseState,
} from '../bridge/windowLifecycle';
import { supportsWindowControls } from '../bridge/window';

type State =
  | { status: 'loading' | 'unavailable'; value?: undefined }
  | { status: 'error'; value?: WindowCloseState }
  | { status: 'success'; value: WindowCloseState };

export function useWindowCloseState() {
  const [state, setState] = useState<State>({
    status: supportsWindowControls() ? 'loading' : 'unavailable',
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!supportsWindowControls()) return;
    const controller = new AbortController();
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void getWindowCloseState(controller.signal).then(
        (value) => {
          if (!controller.signal.aborted && current === generation)
            setState({ status: 'success', value });
        },
        () => {
          if (!controller.signal.aborted && current === generation) {
            setState((previous) => ({ status: 'error', value: previous.value }));
          }
        },
      );
    };
    // 先订阅再读取，既捕获新事件，也恢复 WebView 就绪前已发生的原生关闭请求。
    const unsubscribe = subscribeWindowClose(refresh);
    refresh();
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [revision]);
  return { state, refresh: () => setRevision((value) => value + 1) };
}
