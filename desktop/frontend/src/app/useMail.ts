import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/bridge/mail';
import type { MailFolder } from './WorkspaceSidebar';

export function useMail(folder: MailFolder) {
  const [accounts, setAccounts] = useState<api.AccountSummary[]>([]);
  const [accountId, setAccountId] = useState('');
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<api.MailSummary[]>([]);
  const [reader, setReader] = useState<{ id: string; detail?: api.MailDetail; error?: unknown }>({
    id: '',
  });
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<unknown>();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [revision, setRevision] = useState(0);
  const listRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const detail = reader.id === selected ? reader.detail : undefined;
  const bodyError = reader.id === selected ? reader.error : undefined;
  const loading = selected !== '' && reader.id !== selected;

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await api.accounts(controller.signal);
        if (!controller.signal.aborted) {
          setAccounts(result);
          setReady(true);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error);
          setReady(false);
        }
      } finally {
        pending = false;
      }
    };
    void load();
    const interval = setInterval(() => void load(), 3000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [revision]);

  const syncStamp = accounts
    .map((account) => `${account.id}:${account.sync.running}:${account.sync.lastSyncAt}`)
    .join('|');
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    listRequest.current = controller;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await api.messages(accountId, folder, offset, controller.signal);
        if (!controller.signal.aborted) {
          setMessages(result);
          setError(undefined);
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error);
      } finally {
        pending = false;
      }
    };
    void load();
    const interval = setInterval(() => void load(), 3000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [ready, accountId, folder, offset, revision]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    api
      .message(selected, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setReader({ id: selected, detail: value });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setReader({ id: selected, error });
      });
    return () => controller.abort();
  }, [selected, revision, syncStamp]);

  const chooseAccount = (id: string) => {
    listRequest.current?.abort();
    setAccountId(id);
    setSelected('');
    setOffset(0);
    setMessages([]);
  };
  const sync = async () => {
    try {
      await api.synchronize(accountId);
      refresh();
    } catch (error) {
      setError(error);
    }
  };
  const nextPage = (direction: number) => {
    listRequest.current?.abort();
    setOffset((value) => Math.max(0, value + direction * 100));
    setSelected('');
  };
  const resetView = () => {
    listRequest.current?.abort();
    setSelected('');
    setMessages([]);
    setOffset(0);
    setFilter('');
  };
  const selectMessage = (id: string) => {
    if (id === selected) refresh();
    else setSelected(id);
  };
  const disconnectAccount = async (id: string) => {
    try {
      await api.disconnect(id);
      refresh();
    } catch (error) {
      setError(error);
    }
  };
  return {
    accounts,
    accountId,
    chooseAccount,
    ready,
    messages,
    detail,
    selected,
    setSelected: selectMessage,
    error,
    bodyError,
    loading,
    offset,
    nextPage,
    refresh,
    sync,
    filter,
    setFilter,
    resetView,
    disconnectAccount,
  };
}

export type MailController = ReturnType<typeof useMail>;
