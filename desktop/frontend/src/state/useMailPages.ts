import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { mailApi, type MailSearchQuery } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import { isWailsDesktop } from "./storageHelpers";
import { useMailListArrivals } from "./useMailListArrivals";

export function useMailPages(
  buildQuery: (cursor?: string) => MailSearchQuery,
  accountId: string | null,
  setMails: Dispatch<SetStateAction<MailItem[]>>,
) {
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<{
    scope: typeof buildQuery;
    value: string;
  }>();
  const nextCursor = cursor?.scope === buildQuery ? cursor.value : "";
  const [revision, setRevision] = useState(0);
  const listSeq = useRef(0);
  const countSeq = useRef(0);
  const paging = useRef<object | null>(null);
  const activeQuery = useRef<typeof buildQuery | null>(null);

  const invalidateRequests = useCallback(() => {
    listSeq.current++;
    countSeq.current++;
    paging.current = null;
  }, []);

  const refreshCounts = useCallback(async () => {
    if (activeQuery.current !== buildQuery) return;
    const seq = ++countSeq.current;
    const counts = await mailApi
      .getFolderCounts(accountId ?? "")
      .catch(() => null);
    if (counts && seq === countSeq.current) setFolderCounts(counts);
  }, [accountId, buildQuery]);

  const reloadMessages = useCallback(async () => {
    if (!isWailsDesktop() || activeQuery.current !== buildQuery) return;
    const seq = ++listSeq.current;
    paging.current = null;
    const [page] = await Promise.all([
      mailApi.listMessages(buildQuery()).catch(() => null),
      refreshCounts(),
    ]);
    if (!page || seq !== listSeq.current) return;
    setMails(page.items);
    setCursor({ scope: buildQuery, value: page.nextCursor });
    setTotalCount(page.totalCount);
  }, [buildQuery, refreshCounts, setMails]);
  const listArrivals = useMailListArrivals(
    buildQuery,
    revision,
    reloadMessages,
  );

  useLayoutEffect(() => {
    activeQuery.current = buildQuery;
    return () => {
      // 取消上一筛选的列表、分页和计数回写，不让旧结果覆盖新账户。
      activeQuery.current = null;
      invalidateRequests();
    };
  }, [buildQuery, revision, invalidateRequests]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reloadMessages(), 60);
    return () => window.clearTimeout(timer);
  }, [reloadMessages, revision]);

  const loadMore = useCallback(async () => {
    if (
      !isWailsDesktop() ||
      activeQuery.current !== buildQuery ||
      !nextCursor ||
      paging.current
    )
      return;
    const ticket = {};
    const seq = listSeq.current;
    paging.current = ticket;
    try {
      const page = await mailApi
        .listMessages(buildQuery(nextCursor))
        .catch(() => null);
      if (!page || seq !== listSeq.current) return;
      setMails((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        return [...prev, ...page.items.filter((item) => !ids.has(item.id))];
      });
      setCursor({ scope: buildQuery, value: page.nextCursor });
    } finally {
      if (paging.current === ticket) paging.current = null;
    }
  }, [buildQuery, nextCursor, setMails]);

  const resetPages = useCallback(() => {
    invalidateRequests();
    setFolderCounts({});
    setCursor(undefined);
    setTotalCount(0);
    setRevision((value) => value + 1);
  }, [invalidateRequests]);

  return {
    listArrivals,
    folderCounts,
    totalCount,
    loaded: cursor?.scope === buildQuery,
    hasMore: Boolean(nextCursor),
    loadMore,
    reloadMessages,
    refreshCounts,
    resetPages,
  };
}
