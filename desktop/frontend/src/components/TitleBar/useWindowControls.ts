import { useCallback, useEffect, useRef, useState } from 'react';

import {
  performWindowAction,
  readWindowMaximised,
  subscribeWindowState,
  supportsWindowControls,
  type WindowAction,
} from '../../lib/bridge/window';

export function useWindowControls() {
  const available = supportsWindowControls();
  const [maximised, setMaximised] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle');
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const value = await readWindowMaximised();
      if (mounted.current && current === generation.current) setMaximised(value);
    } catch {
      // StrictMode 或窗口快速切换时，过期请求的失败不能覆盖最新状态。
      if (mounted.current && current === generation.current) throw new Error('无法读取窗口状态');
    }
  }, []);

  useEffect(() => {
    generation.current++;
    mounted.current = true;
    const update = () => {
      void refresh().catch(() => {
        if (mounted.current) setStatus('error');
      });
    };
    if (available) update();
    const unsubscribe = available ? subscribeWindowState(update) : () => {};
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [available, refresh]);

  const perform = async (action: WindowAction) => {
    if (!available || inFlight.current) return;
    inFlight.current = true;
    setStatus('pending');
    try {
      await performWindowAction(action);
      if (action === 'maximize') await refresh();
      if (mounted.current) setStatus('idle');
    } catch {
      if (mounted.current) setStatus('error');
    } finally {
      inFlight.current = false;
    }
  };

  return { available, maximised, status, perform };
}
