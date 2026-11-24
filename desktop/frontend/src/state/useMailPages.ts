import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  mailApi,
  parseBackendError,
  type MailSearchQuery,
} from "../services/backendClient";
import type { MailItem } from "../types/mail";
import {
  canBackfillRemoteFolder,
  type RemoteBackfillEligibility,
} from "./mailListBackfillPolicy";
import { getListReloadDelayMs } from "./mailListLoadingPolicy";
import { isWailsDesktop } from "./storageHelpers";
import { useMailListArrivals } from "./useMailListArrivals";
import {
  emptyScopeState,
  useMailLoadMore,
  type ScopedPageState,
} from "./useMailLoadMore";

export function useMailPages(
  buildQuery: (cursor?: string) => MailSearchQuery,
  accountId: string | null,
  backfillCtx: RemoteBackfillEligibility,
  mails: MailItem[],
  setMails: Dispatch<SetStateAction<MailItem[]>>,
) {
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [pageState, setPageState] = useState<ScopedPageState>();
  const [revision, setRevision] = useState(0);
  const listSeq = useRef(0);
  const countSeq = useRef(0);
  const paging = useRef<object | null>(null);
  const activeQuery = useRef<typeof buildQuery | null>(null);
  const lastSearchRef = useRef(backfillCtx.searchQuery);
  const mailsRef = useRef<MailItem[]>(mails);
  useLayoutEffect(() => {
    mailsRef.current = mails;
  }, [mails]);

  const current =
    pageState?.scope === buildQuery ? pageState : emptyScopeState(buildQuery);
  const isInitialLoading = isWailsDesktop() && !current.loaded;
  const canAutoBackfill = canBackfillRemoteFolder(backfillCtx, false);
  const canManualBackfill = canBackfillRemoteFolder(backfillCtx, true);

  const patchScopeState = useCallback(
    (patch: Partial<Omit<ScopedPageState, "scope">>) => {
      setPageState((prev) => {
        const base =
          prev?.scope === buildQuery ? prev : emptyScopeState(buildQuery);
        return { ...base, ...patch, scope: buildQuery };
      });
    },
    [buildQuery],
  );

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

  const reloadMessages = useCallback(
    async (retryFromEmpty = false) => {
      if (!isWailsDesktop() || activeQuery.current !== buildQuery) return;
      const seq = ++listSeq.current;
      paging.current = null;
      setPageState((prev) => {
        if (retryFromEmpty) return emptyScopeState(buildQuery);
        if (prev?.scope === buildQuery && prev.loaded) {
          return { ...prev, isRefreshing: true, listError: "" };
        }
        return prev;
      });
      void refreshCounts();
      try {
        const page = await mailApi.listMessages(buildQuery());
        if (seq !== listSeq.current) return;
        setMails(page.items);
        setTotalCount(page.totalCount);
        setPageState({
          ...emptyScopeState(buildQuery),
          loaded: true,
          nextCursor: page.nextCursor,
          hasRemoteMore: page.hasRemoteMore,
          remoteTotalCount: page.remoteTotalCount,
        });
      } catch (err) {
        if (seq !== listSeq.current) return;
        patchScopeState({
          loaded: true,
          isRefreshing: false,
          listError: parseBackendError(err).message,
        });
      }
    },
    [buildQuery, patchScopeState, refreshCounts, setMails],
  );

  const listArrivals = useMailListArrivals(
    buildQuery,
    revision,
    reloadMessages,
  );

  useLayoutEffect(() => {
    activeQuery.current = buildQuery;
    return () => {
      activeQuery.current = null;
      invalidateRequests();
    };
  }, [buildQuery, revision, invalidateRequests]);

  useEffect(() => {
    const delay = getListReloadDelayMs(
      lastSearchRef.current,
      backfillCtx.searchQuery,
    );
    lastSearchRef.current = backfillCtx.searchQuery;
    let cancelled = false;
    const run = () => {
      if (!cancelled) void reloadMessages();
    };
    if (delay > 0) {
      const timer = window.setTimeout(run, delay);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    void Promise.resolve().then(run);
    return () => {
      cancelled = true;
    };
  }, [backfillCtx.searchQuery, reloadMessages, revision]);

  const loadMore = useMailLoadMore({
    buildQuery,
    accountId,
    backfillCtx,
    nextCursor: current.nextCursor,
    hasRemoteMore: current.hasRemoteMore,
    loadMoreError: current.loadMoreError,
    listSeqRef: listSeq,
    pagingRef: paging,
    activeQueryRef: activeQuery,
    mailsRef,
    setMails,
    setTotalCount,
    patchScopeState,
    refreshCounts,
  });

  const resetPages = useCallback(() => {
    invalidateRequests();
    setFolderCounts({});
    setPageState(undefined);
    setTotalCount(0);
    setRevision((value) => value + 1);
  }, [invalidateRequests]);

  const { scope: _scope, ...scopedFields } = current;
  void _scope;
  return {
    listArrivals,
    folderCounts,
    totalCount,
    ...scopedFields,
    isInitialLoading,
    hasMore: Boolean(current.nextCursor),
    canAutoBackfill,
    canManualBackfill,
    loadMore,
    reloadMessages,
    refreshCounts,
    resetPages,
  };
}
