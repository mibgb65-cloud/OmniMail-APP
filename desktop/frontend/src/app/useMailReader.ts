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

export function useMailReader(id: string, revision: number, syncStamp: string) {
  const [retry, setRetry] = useState(0);
  const [busyRetry, setBusyRetry] = useState(0);
  const scope = JSON.stringify([id, revision, retry]);
  const query = JSON.stringify([scope, syncStamp, busyRetry]);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    id: '',
    scope: '',
    query: '',
    status: 'success',
  });
  const budget = useRef({ scope: '', deadline: 0, attempts: 0 });
  useEffect(() => {
    if (budget.current.scope !== scope) {
      budget.current = { scope, deadline: Date.now() + BUSY_WAIT_MS, attempts: 0 };
    }
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    api
      .message(id, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted)
          setSnapshot({ id, scope, query, status: 'success', detail });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const remaining = budget.current.deadline - Date.now();
        if (
          api.errorCode(error) === 'BUSY' &&
          remaining > 0 &&
          budget.current.attempts < MAX_BUSY_RETRIES
        ) {
          // 只自动重试幂等的正文读取；沿用账号互斥，不通过并行 IMAP 连接抢占后台同步。
          budget.current.attempts++;
          setSnapshot({ id, scope, query, status: 'waiting' });
          timer = setTimeout(
            () => setBusyRetry((value) => value + 1),
            Math.min(BUSY_RETRY_MS, remaining),
          );
        } else {
          setSnapshot({ id, scope, query, status: 'error', error });
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
  };
}
