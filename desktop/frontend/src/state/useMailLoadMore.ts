import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  mailApi,
  parseBackendError,
  type MailSearchQuery,
} from "../services/backendClient";
import type { MailItem } from "../types/mail";
import {
  buildTailMailCursor,
  canBackfillRemoteFolder,
  mergeOlderMailItems,
  type RemoteBackfillEligibility,
} from "./mailListBackfillPolicy";
import { isWailsDesktop } from "./storageHelpers";

export interface ScopedPageState {
  scope: (cursor?: string) => MailSearchQuery;
  loaded: boolean;
  isRefreshing: boolean;
  listError: string;
  nextCursor: string;
  hasRemoteMore: boolean;
  remoteTotalCount: number;
  loadingMore: boolean;
  loadingRemoteOlder: boolean;
  loadMoreError: string;
}

export function emptyScopeState(
  scope: (cursor?: string) => MailSearchQuery,
): ScopedPageState {
  return {
    scope,
    loaded: false,
    isRefreshing: false,
    listError: "",
    nextCursor: "",
    hasRemoteMore: false,
    remoteTotalCount: 0,
    loadingMore: false,
    loadingRemoteOlder: false,
    loadMoreError: "",
  };
}

interface UseMailLoadMoreParams {
  buildQuery: (cursor?: string) => MailSearchQuery;
  accountId: string | null;
  backfillCtx: RemoteBackfillEligibility;
  nextCursor: string;
  hasRemoteMore: boolean;
  loadMoreError: string;
  listSeqRef: MutableRefObject<number>;
  pagingRef: MutableRefObject<object | null>;
  activeQueryRef: MutableRefObject<
    ((cursor?: string) => MailSearchQuery) | null
  >;
  mailsRef: MutableRefObject<MailItem[]>;
  setMails: Dispatch<SetStateAction<MailItem[]>>;
  setTotalCount: Dispatch<SetStateAction<number>>;
  patchScopeState: (patch: Partial<Omit<ScopedPageState, "scope">>) => void;
  refreshCounts: () => Promise<void>;
}

export function useMailLoadMore({
  buildQuery,
  accountId,
  backfillCtx,
  nextCursor,
  hasRemoteMore,
  loadMoreError,
  listSeqRef,
  pagingRef,
  activeQueryRef,
  mailsRef,
  setMails,
  setTotalCount,
  patchScopeState,
  refreshCounts,
}: UseMailLoadMoreParams) {
  return useCallback(
    async (manual = false) => {
      if (
        !isWailsDesktop() ||
        activeQueryRef.current !== buildQuery ||
        pagingRef.current
      ) {
        return;
      }
      if (!manual && loadMoreError) return;

      const seq = listSeqRef.current;
      const ticket = {};

      if (nextCursor) {
        pagingRef.current = ticket;
        patchScopeState({ loadingMore: true, loadMoreError: "" });
        try {
          const page = await mailApi.listMessages(buildQuery(nextCursor));
          if (seq !== listSeqRef.current) return;
          setMails((prev) => mergeOlderMailItems(prev, page.items));
          setTotalCount(page.totalCount);
          patchScopeState({
            nextCursor: page.nextCursor,
            hasRemoteMore: page.hasRemoteMore,
            remoteTotalCount: page.remoteTotalCount,
            loadingMore: false,
          });
        } catch (err) {
          if (seq === listSeqRef.current) {
            patchScopeState({
              loadingMore: false,
              loadMoreError: parseBackendError(err).message,
            });
          }
        } finally {
          if (pagingRef.current === ticket) pagingRef.current = null;
        }
        return;
      }

      if (!hasRemoteMore || !canBackfillRemoteFolder(backfillCtx, manual)) {
        return;
      }
      pagingRef.current = ticket;
      patchScopeState({ loadingRemoteOlder: true, loadMoreError: "" });
      try {
        const res = await mailApi.loadOlderMessages(
          accountId ?? "",
          backfillCtx.activeFolder,
          50,
        );
        if (seq !== listSeqRef.current) return;
        const tailCursor = buildTailMailCursor(mailsRef.current);
        const [page] = await Promise.all([
          mailApi.listMessages(buildQuery(tailCursor)),
          refreshCounts(),
        ]);
        if (seq !== listSeqRef.current) return;
        if (page.items.length > 0) {
          setMails((prev) => mergeOlderMailItems(prev, page.items));
        }
        setTotalCount(page.totalCount);
        patchScopeState({
          nextCursor: page.nextCursor,
          hasRemoteMore: res.hasRemoteMore,
          remoteTotalCount: Math.max(res.remoteTotal, page.remoteTotalCount),
          loadingRemoteOlder: false,
          loadMoreError: "",
        });
      } catch (err) {
        if (seq === listSeqRef.current) {
          patchScopeState({
            loadingRemoteOlder: false,
            loadMoreError: parseBackendError(err).message,
          });
        }
      } finally {
        if (pagingRef.current === ticket) pagingRef.current = null;
      }
    },
    [
      accountId,
      activeQueryRef,
      backfillCtx,
      buildQuery,
      hasRemoteMore,
      listSeqRef,
      loadMoreError,
      mailsRef,
      nextCursor,
      pagingRef,
      patchScopeState,
      refreshCounts,
      setMails,
      setTotalCount,
    ],
  );
}
