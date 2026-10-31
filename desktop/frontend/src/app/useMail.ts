import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/bridge/mail';
import type { MailFolder } from './WorkspaceSidebar';
import { useMailList } from './useMailList';
import { useMailReader } from './useMailReader';
import { useMailStarred } from './useMailStarred';
import { useMailActions } from './useMailActions';
import { DEFAULT_MAIL_VIEW, type MailViewOptions } from './mailView';

export function useMail(folder: MailFolder) {
  const [accounts, setAccounts] = useState<api.AccountSummary[]>([]);
  const [accountId, setAccountId] = useState('');
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<unknown>();
  const [viewRevision, setViewRevision] = useState(0);
  const [filter, setFilter] = useState('');
  const [viewOptions, setViewOptions] = useState<MailViewOptions>(DEFAULT_MAIL_VIEW);
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
  const revalidatedDetail = useRef<api.MailDetail>();
  useEffect(() => {
    // 首次下载正文才确认附件信息，重验本地列表；不为附件筛选自动下载所有邮件。
    if (
      reader.detail?.cached &&
      revalidatedDetail.current !== reader.detail &&
      list.messages.some((message) => message.id === reader.detail?.id && !message.cached)
    ) {
      revalidatedDetail.current = reader.detail;
      refresh();
    }
  }, [reader.detail, list.messages, refresh]);
  const actions = useMailActions(
    list.listKey,
    list.messages,
    refresh,
    (id) => setSelected((current) => (current === id ? '' : current)),
    selected,
  );
  const stars = useMailStarred(
    JSON.stringify([accountId, folder]),
    folder,
    (id) => setSelected((current) => (current === id ? '' : current)),
    refresh,
    actions.messages,
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
    setViewOptions(DEFAULT_MAIL_VIEW);
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
    actionBusy: actions.actionBusy,
    actionError: actions.actionError,
    autoReadError: actions.autoReadError,
    markViewed: (id: string) => {
      if (id !== selected || reader.detail?.id !== id || reader.bodyError != null || reader.loading)
        return;
      const message = actions.messages.find((item) => item.id === id);
      if (
        message &&
        !message.read &&
        accounts.some(
          (account) => account.id === message.accountId && account.status === 'configured',
        )
      )
        actions.markViewed(id);
    },
    runAction: actions.runAction,
    viewOptions,
    setViewOptions,
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
