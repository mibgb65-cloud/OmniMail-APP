import { useEffect, useRef, useState } from 'react';

import * as api from '../lib/bridge/mail';
import type { MailFolder } from './WorkspaceSidebar';

const PAGE_SIZE = 100;
// 与仓储 PageMail 的既有边界保持一致，不向后端发送超范围偏移。
const MAX_OFFSET = 1_000_000;

export interface MailListQuery {
  ready: boolean;
  accountId: string;
  folder: MailFolder;
  revision: number;
  viewRevision: number;
  syncStamp: string;
}

interface ListSnapshot {
  scope: string;
  query: string;
  messages: api.MailSummary[];
  pageCount: number;
  offset: number;
  more: boolean;
  status: 'success' | 'loading' | 'error';
  error?: unknown;
  failedOperation?: 'refresh' | 'append';
}

function uniqueMessages(messages: api.MailSummary[]) {
  return [...new Map(messages.map((message) => [message.id, message])).values()];
}

export function useMailList({
  ready,
  accountId,
  folder,
  revision,
  viewRevision,
  syncStamp,
}: MailListQuery) {
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([accountId, folder, viewRevision]);
  const query = JSON.stringify([scope, revision, syncStamp, retry]);
  const [snapshot, setSnapshot] = useState<ListSnapshot>({
    scope: '',
    query: '',
    messages: [],
    pageCount: 0,
    offset: 0,
    more: false,
    status: 'success',
  });
  const request = useRef<AbortController | null>(null);
  const pages = useRef({ scope: '', count: 1 });

  useEffect(() => {
    if (!ready) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (pages.current.scope !== scope) pages.current = { scope, count: 1 };
    const pageCount = pages.current.count;
    const refresh = async () => {
      try {
        const messages: api.MailSummary[] = [];
        let offset = 0;
        let more = false;
        let count = 0;
        // 同步变化时重验已加载范围，整批成功再替换，避免只留下最后一页或半个快照。
        while (count < pageCount && offset <= MAX_OFFSET) {
          const batch = await api.messages(accountId, folder, offset, controller.signal);
          if (controller.signal.aborted) return;
          messages.push(...batch);
          offset += batch.length;
          count++;
          more = batch.length === PAGE_SIZE;
          if (!more) break;
        }
        pages.current = { scope, count };
        setSnapshot({
          scope,
          query,
          messages: uniqueMessages(messages),
          pageCount: count,
          offset,
          more,
          status: 'success',
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSnapshot((previous) => ({
            scope,
            query,
            messages: previous.scope === scope ? previous.messages : [],
            pageCount: previous.scope === scope ? previous.pageCount : 0,
            offset: previous.scope === scope ? previous.offset : 0,
            more: previous.scope === scope && previous.more,
            status: 'error',
            failedOperation: 'refresh',
            error,
          }));
        }
      } finally {
        if (request.current === controller) request.current = null;
      }
    };
    void refresh();
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [ready, accountId, folder, scope, query]);

  const append = async (retryError = false) => {
    if (
      !ready ||
      request.current ||
      snapshot.scope !== scope ||
      snapshot.query !== query ||
      !snapshot.more ||
      snapshot.offset > MAX_OFFSET ||
      (snapshot.status === 'error' && !retryError)
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setSnapshot((value) => ({ ...value, status: 'loading', error: undefined }));
    try {
      const batch = await api.messages(accountId, folder, snapshot.offset, controller.signal);
      if (controller.signal.aborted) return;
      pages.current = { scope, count: pages.current.count + 1 };
      setSnapshot((value) => ({
        scope,
        query,
        messages: uniqueMessages([...value.messages, ...batch]),
        pageCount: pages.current.count,
        // 按实际读取数推进，而不是去重后的条数，避免同步位移产生重复读取。
        offset: snapshot.offset + batch.length,
        more: batch.length === PAGE_SIZE,
        status: 'success',
      }));
    } catch (error) {
      if (!controller.signal.aborted) {
        setSnapshot((value) => ({ ...value, status: 'error', error, failedOperation: 'append' }));
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  };
  const retryList = () => {
    if (!ready || request.current || snapshot.scope !== scope || snapshot.status !== 'error')
      return;
    if (snapshot.failedOperation === 'append') void append(true);
    else setRetry((value) => value + 1);
  };
  const visible = snapshot.scope === scope;
  return {
    messages: visible ? snapshot.messages : [],
    listKey: scope,
    listPageCount: visible ? snapshot.pageCount : 0,
    listLoading: ready && (!visible || snapshot.query !== query || snapshot.status === 'loading'),
    listError: visible && snapshot.query === query ? snapshot.error : undefined,
    hasMore: visible && snapshot.more && snapshot.offset <= MAX_OFFSET,
    listLimitReached: visible && snapshot.more && snapshot.offset > MAX_OFFSET,
    loadMore: () => void append(),
    retryList,
  };
}
