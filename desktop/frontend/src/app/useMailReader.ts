import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/bridge/mail';

const BUSY_RETRY_MS = 1500;
const BUSY_WAIT_MS = 60_000;
const MAX_BUSY_RETRIES = 40;
interface Snapshot {
  id: string;
  scope: string;
  query: string;
  status: 'success' | 'waiting' | 'error';
  detail?: api.MailDetail;
  error?: unknown;
}

export function useMailReader(id: string) {
  const [retry, setRetry] = useState(0);
  const [busyRetry, setBusyRetry] = useState(0);
  const scope = JSON.stringify([id, retry]);
  const query = JSON.stringify([scope, busyRetry]);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    id: '',
    scope: '',
    query: '',
    status: 'success',
  });
  const budget = useRef({ scope: '', deadline: 0, attempts: 0 });
  const refresh = useRef({ id: '', requested: false });
  useEffect(() => {
    if (refresh.current.id !== id) refresh.current = { id, requested: false };
    if (budget.current.scope !== scope) {
      budget.current = { scope, deadline: Date.now() + BUSY_WAIT_MS, attempts: 0 };
    }
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = refresh.current.requested ? api.refreshMessage : api.message;
    read(id, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) {
          refresh.current.requested = false;
          setSnapshot({ id, scope, query, status: 'success', detail });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const remaining = budget.current.deadline - Date.now();
        if (
          api.errorCode(error) === 'BUSY' &&
          remaining > 0 &&
          budget.current.attempts < MAX_BUSY_RETRIES
        ) {
          // 正文不再与后台同步互斥；仅为显式账号撤销等短暂 BUSY 保留有界兼容重试。
          budget.current.attempts++;
          setSnapshot((previous) => ({
            id,
            scope,
            query,
            status: 'waiting',
            detail: previous.id === id ? previous.detail : undefined,
          }));
          timer = setTimeout(
            () => setBusyRetry((value) => value + 1),
            Math.min(BUSY_RETRY_MS, remaining),
          );
        } else {
          setSnapshot((previous) => ({
            id,
            scope,
            query,
            status: 'error',
            error,
            detail: previous.id === id ? previous.detail : undefined,
          }));
        }
      });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, scope, query]);

  return {
    detail: id && snapshot.id === id ? snapshot.detail : undefined,
    bodyError: snapshot.query === query ? snapshot.error : undefined,
    bodyWaiting: !!id && snapshot.scope === scope && snapshot.status === 'waiting',
    loading: !!id && (snapshot.query !== query || snapshot.status === 'waiting'),
    retryBody: () => setRetry((value) => value + 1),
    refreshBody: () => {
      refresh.current = { id, requested: true };
      setRetry((value) => value + 1);
    },
  };
}
