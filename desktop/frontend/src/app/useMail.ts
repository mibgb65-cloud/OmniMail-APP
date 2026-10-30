import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/bridge/mail';
import type { MailFolder } from './WorkspaceSidebar';
import { useMailList } from './useMailList';
import { useMailReader } from './useMailReader';
import { useMailStarred } from './useMailStarred';

export function useMail(folder: MailFolder) {
  const [accounts, setAccounts] = useState<api.AccountSummary[]>([]);
  const [accountId, setAccountId] = useState('');
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<unknown>();
  const [viewRevision, setViewRevision] = useState(0);
  const [filter, setFilter] = useState('');
  const [revision, setRevision] = useState(0);
  const [syncRequested, setSyncRequested] = useState(false);
  const refresh = useCallback(() => {
    setError(undefined);
    setRevision((value) => value + 1);
  }, []);

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
          // 已成功读取后保留缓存视图，瞬时状态读取失败不能把真实邮件退回演示空态。
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
  // 后台状态仅驱动列表重验，不能取消用户正在等待的正文。
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

  const reader = useMailReader(selected);
  const stars = useMailStarred(
    JSON.stringify([accountId, folder]),
    folder,
    (id) => setSelected((current) => (current === id ? '' : current)),
    refresh,
    list.messages,
    accountId,
  );

  const chooseAccount = (id: string) => {
    setAccountId(id);
    setSelected('');
    setViewRevision((value) => value + 1);
  };
  const sync = async () => {
    if (syncRequested) return;
    setSyncRequested(true);
    setError(undefined);
    try {
      await api.synchronize(accountId);
      refresh();
    } catch (error) {
      setError(error);
    } finally {
      setSyncRequested(false);
    }
  };
  const resetView = () => {
    setSelected('');
    setViewRevision((value) => value + 1);
    setFilter('');
  };
  const selectMessage = (id: string) => {
    if (id === selected) reader.retryBody();
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
    ...reader,
    ...stars,
    selected,
    setSelected: selectMessage,
    error,
    refresh,
    sync,
    syncRequested,
    filter,
    setFilter,
    resetView,
    disconnectAccount,
  };
}

export type MailController = ReturnType<typeof useMail>;
