import { useEffect, useState, type MutableRefObject } from 'react';
import * as api from '../../lib/bridge/mail';
import type { BatchRequest, BatchResult } from './accountBatch';

export function useSameProviderBatch(
  requestRef: MutableRefObject<AbortController | null>,
  onAdded: (id: number, account: api.AccountSummary) => void,
  onUncertain: (id: number) => void,
) {
  const [results, setResults] = useState<Record<number, BatchResult>>({});
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => () => requestRef.current?.abort(), [requestRef]);
  const run = async (inputs: BatchRequest[]) => {
    if (running || requestRef.current) return;
    const pending = inputs.filter(
      (item) => results[item.id]?.status !== 'added' && results[item.id]?.status !== 'review',
    );
    if (!pending.length) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setRunning(true);
    setStarted(true);
    setResults((previous) => {
      const next = { ...previous };
      for (const item of pending) {
        next[item.id] = {
          id: item.id,
          email: item.input.email,
          name: item.input.displayName,
          status: 'queued',
        };
      }
      return next;
    });
    try {
      // 后端 AddAccount 有全局互斥锁，必须串行；失败继续下一项，成功项不可再次提交。
      for (const item of pending) {
        if (controller.signal.aborted) break;
        const identity = { id: item.id, email: item.input.email, name: item.input.displayName };
        setResults((previous) => ({
          ...previous,
          [item.id]: { ...identity, status: 'verifying' },
        }));
        let account: api.AccountSummary;
        try {
          account = await api.addAccount(item.input, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) break;
          const errorCode = api.errorCode(error);
          // 超时/桥接丢失/保存不确定时可能已落库，不能把它当成普通失败再次创建。
          const uncertain = [
            'CANCELED',
            'TIMEOUT',
            'BRIDGE_UNAVAILABLE',
            'STORAGE_FAILED',
            'CREDENTIAL_CLEANUP_FAILED',
            'SAVE_FAILED',
            'SEND_UNCERTAIN',
          ].includes(errorCode);
          setResults((previous) => ({
            ...previous,
            [item.id]: { ...identity, status: uncertain ? 'review' : 'failed', errorCode },
          }));
          if (uncertain) onUncertain(item.id);
          continue;
        }
        if (controller.signal.aborted) break;
        setResults((previous) => ({
          ...previous,
          [item.id]: { ...identity, status: 'added', account },
        }));
        // 通知失败不能把已经创建的账号改标为失败，否则重试会重复创建。
        onAdded(item.id, account);
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setRunning(false);
    }
  };
  const reset = () => {
    if (running || requestRef.current) return;
    setResults({});
    setStarted(false);
  };
  return { results, running, started, run, reset };
}
