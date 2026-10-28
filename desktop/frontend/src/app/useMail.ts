import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/bridge/mail';
import type { MailFolder } from './WorkspaceSidebar';
import { useMailList } from './useMailList';

export function useMail(folder: MailFolder) {
  const [accounts, setAccounts] = useState<api.AccountSummary[]>([]);
  const [accountId, setAccountId] = useState('');
  const [ready, setReady] = useState(false);
  const [reader, setReader] = useState<{ id: string; detail?: api.MailDetail; error?: unknown }>({
    id: '',
  });
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<unknown>();
  const [viewRevision, setViewRevision] = useState(0);
  const [filter, setFilter] = useState('');
  const [revision, setRevision] = useState(0);
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
          setError(undefined);
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

  const relevantAccounts = accounts.filter((account) => !accountId || account.id === accountId);
  const syncStamp = relevantAccounts
    .map((account) => `${account.id}:${account.sync.running}:${account.sync.lastSyncAt}`)
    .join('|');
  // 断开或部分同步失败未必推进时间戳，列表仍须重验；正文保留原有触发条件。
  const listStamp = JSON.stringify(
    relevantAccounts.map(({ id, status, sync }) => [
      id,
      status,
      sync.running,
      sync.more,
      sync.errorCode,
      sync.lastSyncAt,
    ]),
  );
  const list = useMailList({
    ready,
    accountId,
    folder,
    revision,
    viewRevision,
    syncStamp: listStamp,
  });

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
    setAccountId(id);
    setSelected('');
    setViewRevision((value) => value + 1);
  };
  const sync = async () => {
    try {
      await api.synchronize(accountId);
      refresh();
    } catch (error) {
      setError(error);
    }
  };
  const resetView = () => {
    setSelected('');
    setViewRevision((value) => value + 1);
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
    ...list,
    detail,
    selected,
    setSelected: selectMessage,
    error,
    bodyError,
    loading,
    refresh,
    sync,
    filter,
    setFilter,
    resetView,
    disconnectAccount,
  };
}

export type MailController = ReturnType<typeof useMail>;
