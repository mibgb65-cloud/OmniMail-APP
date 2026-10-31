import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/bridge/mail';

export type MailAction = 'read' | 'archive' | 'deleted' | 'allRead' | 'markRead';
interface Change {
  read?: boolean;
  removed?: boolean;
}

export function useMailActions(
  scope: string,
  base: api.MailSummary[],
  refresh: () => void,
  unselect: (id: string) => void,
  selected = '',
) {
  const active = useRef(scope);
  const latest = useRef(base);
  const locked = useRef(false);
  const mounted = useRef(false);
  const selection = useRef(selected);
  const queuedRead = useRef<{ scope: string; id: string }>();
  const manualUnread = useRef<{ scope: string; id: string }>();
  const drain = useRef<() => void>(() => {});
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{
    scope: string;
    error?: unknown;
    autoError?: { id: string; error: unknown };
  }>({ scope });
  const [changes, setChanges] = useState<{
    scope: string;
    snapshot: api.MailSummary[];
    values: Record<string, Change>;
  }>({ scope, snapshot: base, values: {} });
  useLayoutEffect(() => {
    active.current = scope;
    latest.current = base;
    selection.current = selected;
    if (queuedRead.current?.scope !== scope || queuedRead.current?.id !== selected)
      queuedRead.current = undefined;
    if (manualUnread.current?.scope !== scope || manualUnread.current?.id !== selected)
      manualUnread.current = undefined;
  }, [scope, base, selected]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(
    async (action: MailAction, targets: api.MailSummary[]) => {
      if (locked.current || !targets.length) return;
      locked.current = true;
      setPending(true);
      const requestScope = scope;
      setStatus((previous) => {
        const current = previous.scope === scope ? previous : { scope };
        return action === 'markRead'
          ? { ...current, autoError: undefined }
          : { ...current, error: undefined };
      });
      try {
        // 批量已读逐封确认；部分失败保留已成功项，停止后续请求而不是伪装成整批成功。
        for (const message of targets) {
          const readAction = action === 'read' || action === 'allRead' || action === 'markRead';
          const wanted = action !== 'read' || !message.read;
          if (readAction && action !== 'markRead' && message.id === selection.current)
            manualUnread.current = wanted ? undefined : { scope: requestScope, id: message.id };
          if (readAction) await api.setRead(message.id, wanted);
          else await api.moveMessage(message.id, action);
          // 用户显式修改同一封邮件时优先，不能在其手动未读后补发已排队的自动已读。
          if (queuedRead.current?.scope === requestScope && queuedRead.current.id === message.id)
            queuedRead.current = undefined;
          if (!mounted.current || active.current !== requestScope) break;
          const change: Change = readAction ? { read: wanted } : { removed: true };
          setChanges((previous) => ({
            scope: requestScope,
            snapshot: latest.current,
            values: {
              ...(previous.scope === requestScope && previous.snapshot === latest.current
                ? previous.values
                : {}),
              [message.id]: change,
            },
          }));
          if (readAction && action !== 'markRead')
            setStatus((previous) =>
              previous.scope === requestScope && previous.autoError?.id === message.id
                ? { ...previous, autoError: undefined }
                : previous,
            );
          if (change.removed) unselect(message.id);
        }
      } catch (error) {
        if (mounted.current)
          setStatus((previous) => {
            const current = previous.scope === requestScope ? previous : { scope: requestScope };
            return action === 'markRead'
              ? { ...current, autoError: { id: targets[0]?.id ?? '', error } }
              : { ...current, error };
          });
      } finally {
        locked.current = false;
        if (mounted.current) {
          setPending(false);
          refresh();
          drain.current();
        }
      }
    },
    [scope, refresh, unselect],
  );
  const messages = useMemo(() => {
    const values = changes.scope === scope && changes.snapshot === base ? changes.values : {};
    return base
      .filter((message) => !values[message.id]?.removed)
      .map((message) => {
        const read = values[message.id]?.read;
        return read === undefined ? message : { ...message, read };
      });
  }, [base, changes, scope]);
  useLayoutEffect(() => {
    drain.current = () => {
      if (locked.current || !mounted.current) return;
      const request = queuedRead.current;
      queuedRead.current = undefined;
      if (!request || request.scope !== active.current || request.id !== selection.current) return;
      if (manualUnread.current?.scope === request.scope && manualUnread.current.id === request.id)
        return;
      const target = messages.find((message) => message.id === request.id);
      if (target && !target.read) void run('markRead', [target]);
    };
  }, [messages, run]);
  const markViewed = (id: string) => {
    if (!mounted.current || scope !== active.current || id !== selection.current) return;
    queuedRead.current = { scope, id };
    drain.current();
  };
  return {
    messages,
    actionBusy: pending,
    actionError: status.scope === scope ? status.error : undefined,
    autoReadError:
      status.scope === scope && status.autoError?.id === selected
        ? status.autoError.error
        : undefined,
    markViewed,
    runAction: run,
  };
}
