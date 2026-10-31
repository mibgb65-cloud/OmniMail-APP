import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MailController } from './useMail';
import { revealMailList } from '../lib/mail/mailReveal';

export function useMailListTransition({
  listLoading,
  listPageCount,
  listError,
}: Pick<MailController, 'listLoading' | 'listPageCount' | 'listError'>) {
  const listRef = useRef<HTMLUListElement>(null);
  const revealed = useRef(false);
  // 真实查询切换先发布空的 pending scope；已挂载列表的后台刷新不重新进入骨架。
  const [armed] = useState(listLoading || listPageCount === 0);
  const [elapsed, setElapsed] = useState(
    () => !armed || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const hasError = listError != null;
  const waiting = armed && !hasError && (!elapsed || listPageCount === 0);

  useEffect(() => {
    if (!armed || elapsed) return;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const finish = () => {
      if (media?.matches) setElapsed(true);
    };
    // 与读取并行等待，慢请求完成后不再额外增加一段固定延迟。
    const timer = setTimeout(() => setElapsed(true), media?.matches ? 0 : 280);
    media?.addEventListener?.('change', finish);
    return () => {
      clearTimeout(timer);
      media?.removeEventListener?.('change', finish);
    };
  }, [armed, elapsed]);

  useLayoutEffect(() => {
    if (waiting || hasError || revealed.current || !listRef.current) return;
    revealed.current = true;
    return revealMailList(listRef.current);
  }, [waiting, hasError]);

  return { waiting, listRef };
}
