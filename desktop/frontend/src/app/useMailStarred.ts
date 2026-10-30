import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as api from '../lib/bridge/mail';
import type { MailFolder } from './WorkspaceSidebar';

interface StarOverride {
  wanted: boolean;
  status: 'pending' | 'confirmed';
  snapshot?: api.MailSummary[];
  message: api.MailSummary;
}
const EMPTY_MESSAGES: api.MailSummary[] = [];

function activeOverrides(values: Record<string, StarOverride>, base: api.MailSummary[]) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value.status === 'pending' || value.snapshot === base,
    ),
  );
}

export function useMailStarred(
  scope: string,
  folder: MailFolder,
  onUnselect: (id: string) => void,
  refresh: () => void,
  baseMessages: api.MailSummary[] = EMPTY_MESSAGES,
  accountId = '',
) {
  const activeScope = useRef(scope);
  const mounted = useRef(false);
  const pending = useRef(new Set<string>());
  const latestBase = useRef(baseMessages);
  const [overrides, setOverrides] = useState<Record<string, StarOverride>>({});
  const [state, setState] = useState<{ scope: string; accountId?: string; error?: unknown }>({
    scope: '',
  });
  useLayoutEffect(() => {
    activeScope.current = scope;
    latestBase.current = baseMessages;
  }, [scope, baseMessages]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const toggleStarred = async (message: api.MailSummary) => {
    if (pending.current.has(message.id)) return;
    pending.current.add(message.id);
    const wanted = !message.starred;
    const requestScope = scope;
    setState({ scope });
    setOverrides((previous) => ({
      ...activeOverrides(previous, latestBase.current),
      [message.id]: { wanted, status: 'pending', message },
    }));
    try {
      await api.setStarred(message.id, wanted);
      if (!mounted.current) return;
      // 等完成后的新数据库快照接管，再移除临时显示，避免旧列表闪回。
      setOverrides((previous) => ({
        ...activeOverrides(previous, latestBase.current),
        [message.id]: { wanted, status: 'confirmed', snapshot: latestBase.current, message },
      }));
      if (activeScope.current === requestScope && folder === 'starred' && message.starred)
        onUnselect(message.id);
      refresh();
    } catch (error) {
      if (mounted.current) {
        setOverrides((previous) => ({
          ...activeOverrides(previous, latestBase.current),
          [message.id]: {
            wanted: message.starred,
            status: 'confirmed',
            snapshot: latestBase.current,
            message,
          },
        }));
        refresh();
        setState({ scope: requestScope, accountId: message.accountId, error });
      }
    } finally {
      pending.current.delete(message.id);
    }
  };
  const displayed = activeOverrides(overrides, baseMessages);
  const pendingIds = Object.entries(displayed)
    .filter(([, value]) => value.status === 'pending')
    .map(([id]) => id);
  const existingIds = new Set(baseMessages.map((message) => message.id));
  const added =
    folder === 'starred'
      ? Object.values(displayed)
          .filter(
            (value) =>
              value.wanted &&
              !existingIds.has(value.message.id) &&
              (!accountId || value.message.accountId === accountId),
          )
          .map((value) => value.message)
      : [];
  const candidates = added.length
    ? [...baseMessages, ...added].sort(
        (a, b) => b.receivedAt - a.receivedAt || b.id.localeCompare(a.id),
      )
    : baseMessages;
  const messages = candidates
    .map((message) => {
      const override = displayed[message.id];
      return override ? { ...message, starred: override.wanted } : message;
    })
    .filter((message) => folder !== 'starred' || message.starred);
  return {
    messages,
    starPending: pendingIds[0] ?? '',
    isStarPending: (id: string) => displayed[id]?.status === 'pending',
    starError: !accountId || state.accountId === accountId ? state.error : undefined,
    toggleStarred,
  };
}
