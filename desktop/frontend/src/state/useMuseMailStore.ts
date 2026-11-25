import { useCallback, useEffect, useMemo, useState } from "react";
import {
  museMailApi,
  parseBackendError,
  type ParsedBackendError,
} from "../services/backendClient";
import {
  INITIAL_MUSE_STATUS,
  type MuseStatus,
  type MuseThreadDetail,
  type MuseThreadSummary,
} from "../types/muse";
import type { WorkspaceScreen } from "../types/ui";
import {
  useMuseCollectionReset,
  type MuseToastPushFn,
} from "./museStoreHelpers";

export function useMuseMailStore(
  activeProfileId: string,
  screen: WorkspaceScreen,
  setScreen: (next: WorkspaceScreen) => void,
  pushToast: MuseToastPushFn,
) {
  const [status, setStatus] = useState<MuseStatus>(INITIAL_MUSE_STATUS);
  const [threads, setThreads] = useState<MuseThreadSummary[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [threadDetail, setThreadDetail] = useState<MuseThreadDetail | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeError, setActiveError] = useState<ParsedBackendError | null>(
    null,
  );
  const [clearedBySessionReset, setClearedBySessionReset] = useState(false);

  const ctrl = useMemo(
    () => ({
      setStatus,
      setThreads,
      setNextCursor,
      setHasMore,
      setSelectedThreadId,
      setThreadDetail,
      setListLoading,
      setLoadingMore,
      setDetailLoading,
      setActiveError,
      setClearedBySessionReset,
    }),
    [],
  );

  const {
    listEpochRef,
    detailEpochRef,
    wipeMemoryCollections,
    handleFatalCode,
    cancelRefresh,
    useDisconnectAndReset,
  } = useMuseCollectionReset(ctrl);

  const { disconnect, resetForWorkspaceSwitch } = useDisconnectAndReset(
    screen,
    setScreen,
    pushToast,
  );

  useEffect(() => {
    let alive = true;
    void museMailApi
      .getStatus()
      .catch(() => INITIAL_MUSE_STATUS)
      .then((next) => {
        if (!alive) return;
        setStatus(next);
        if (!next.bound) wipeMemoryCollections();
      });
    return () => {
      alive = false;
    };
  }, [activeProfileId, wipeMemoryCollections]);

  const selectThread = useCallback(
    async (threadId: string) => {
      if (!threadId) return;
      const myEpoch = ++detailEpochRef.current;
      setSelectedThreadId(threadId);
      setDetailLoading(true);
      try {
        const detail = await museMailApi.getThread(threadId);
        if (detailEpochRef.current === myEpoch) {
          setThreadDetail(detail);
          setActiveError(null);
        }
      } catch (err) {
        if (detailEpochRef.current === myEpoch)
          handleFatalCode(parseBackendError(err));
      } finally {
        if (detailEpochRef.current === myEpoch) setDetailLoading(false);
      }
    },
    [detailEpochRef, handleFatalCode],
  );

  const refreshThreads = useCallback(async () => {
    const myEpoch = ++listEpochRef.current;
    setListLoading(true);
    setActiveError(null);
    setClearedBySessionReset(false);
    try {
      const page = await museMailApi.listThreads("");
      if (listEpochRef.current !== myEpoch) return;
      setThreads(page.threads);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setStatus((prev) => ({
        ...prev,
        bound: true,
        loginStage: "connected",
        verifiedEmail: page.email || prev.verifiedEmail,
        accountName: page.accountName || prev.accountName,
        lastRefreshedAt: page.lastRefreshedAt,
        lastErrorCode: undefined,
      }));
      if (page.threads.length > 0) void selectThread(page.threads[0].id);
      else setThreadDetail(null);
    } catch (err) {
      if (listEpochRef.current === myEpoch)
        handleFatalCode(parseBackendError(err));
    } finally {
      if (listEpochRef.current === myEpoch) setListLoading(false);
    }
  }, [handleFatalCode, listEpochRef, selectThread]);

  const loadMoreThreads = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore || listLoading) return;
    const myEpoch = listEpochRef.current;
    setLoadingMore(true);
    try {
      const page = await museMailApi.listThreads(nextCursor);
      if (listEpochRef.current !== myEpoch) return;
      setThreads((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.threads.filter((i) => !seen.has(i.id))];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (listEpochRef.current === myEpoch)
        handleFatalCode(parseBackendError(err));
    } finally {
      if (listEpochRef.current === myEpoch) setLoadingMore(false);
    }
  }, [
    handleFatalCode,
    hasMore,
    listEpochRef,
    listLoading,
    loadingMore,
    nextCursor,
  ]);

  const applyConnectedStatus = useCallback(
    (next: MuseStatus) => {
      setStatus(next);
      setClearedBySessionReset(false);
      setActiveError(null);
      setScreen("muse");
      void refreshThreads();
    },
    [refreshThreads, setScreen],
  );

  return {
    status,
    threads,
    hasMore,
    selectedThreadId,
    threadDetail,
    listLoading,
    loadingMore,
    detailLoading,
    activeError,
    clearedBySessionReset,
    refreshThreads,
    loadMoreThreads,
    cancelRefresh,
    selectThread,
    applyConnectedStatus,
    disconnect,
    resetForWorkspaceSwitch,
  };
}
