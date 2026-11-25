import { useMemo, useRef, useState } from "react";
import type { ParsedBackendError } from "../services/backendClient";
import type { ToastNotice, WorkspaceScreen } from "../types/ui";
import {
  EMPTY_DAILY_QUOTA,
  type WorkBuddyAccount,
  type WorkBuddyDailyQuota,
  type WorkBuddyDirection,
  type WorkBuddyMessageDetail,
  type WorkBuddyMessageSummary,
} from "../types/workbuddy";

export type WorkBuddyToastFn = (
  notice: Omit<ToastNotice, "id" | "exiting">,
) => void;

export interface PendingDeleteTarget {
  messageId: string;
  subject: string;
  confirmationToken: string;
  preparing: boolean;
}

export interface WorkBuddyStateMutators {
  getSeq: () => number;
  bumpSeq: () => number;
  getDetailSeq: () => number;
  bumpDetailSeq: () => number;
  setAccounts: React.Dispatch<React.SetStateAction<WorkBuddyAccount[]>>;
  setActiveAccountId: React.Dispatch<React.SetStateAction<string>>;
  setDailyQuota: React.Dispatch<React.SetStateAction<WorkBuddyDailyQuota>>;
  setLastSyncedAt: React.Dispatch<React.SetStateAction<number>>;
  setMessages: React.Dispatch<React.SetStateAction<WorkBuddyMessageSummary[]>>;
  setNextCursor: React.Dispatch<React.SetStateAction<string>>;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMessageId: React.Dispatch<React.SetStateAction<string>>;
  setMessageDetail: React.Dispatch<
    React.SetStateAction<WorkBuddyMessageDetail | null>
  >;
  setListLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  setDetailLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  setSavingAttachmentId: React.Dispatch<React.SetStateAction<string>>;
  setPendingDelete: React.Dispatch<
    React.SetStateAction<PendingDeleteTarget | null>
  >;
  setActiveError: React.Dispatch<
    React.SetStateAction<ParsedBackendError | null>
  >;
}

export function resetAllWorkBuddyState(
  m: WorkBuddyStateMutators,
  screen?: WorkspaceScreen,
  setScreen?: (next: WorkspaceScreen) => void,
) {
  m.bumpSeq();
  m.bumpDetailSeq();
  m.setAccounts([]);
  m.setActiveAccountId("");
  m.setDailyQuota(EMPTY_DAILY_QUOTA);
  m.setLastSyncedAt(0);
  m.setMessages([]);
  m.setNextCursor("");
  m.setHasMore(false);
  m.setSelectedMessageId("");
  m.setMessageDetail(null);
  m.setListLoading(false);
  m.setLoadingMore(false);
  m.setDetailLoading(false);
  m.setDeleting(false);
  m.setSavingAttachmentId("");
  m.setPendingDelete(null);
  m.setActiveError(null);
  if (screen === "workbuddy" && setScreen) setScreen("mail");
}

export function useWorkBuddyStateCells() {
  const [accounts, setAccounts] = useState<WorkBuddyAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [dir, setDir] = useState<WorkBuddyDirection>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dailyQuota, setDailyQuota] =
    useState<WorkBuddyDailyQuota>(EMPTY_DAILY_QUOTA);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const [messages, setMessages] = useState<WorkBuddyMessageSummary[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [messageDetail, setMessageDetail] =
    useState<WorkBuddyMessageDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingAttachmentId, setSavingAttachmentId] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<PendingDeleteTarget | null>(null);
  const [activeError, setActiveError] = useState<ParsedBackendError | null>(
    null,
  );

  const seqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const mutators = useMemo<WorkBuddyStateMutators>(
    () => ({
      getSeq: () => seqRef.current,
      bumpSeq: () => ++seqRef.current,
      getDetailSeq: () => detailSeqRef.current,
      bumpDetailSeq: () => ++detailSeqRef.current,
      setAccounts,
      setActiveAccountId,
      setDailyQuota,
      setLastSyncedAt,
      setMessages,
      setNextCursor,
      setHasMore,
      setSelectedMessageId,
      setMessageDetail,
      setListLoading,
      setLoadingMore,
      setDetailLoading,
      setDeleting,
      setSavingAttachmentId,
      setPendingDelete,
      setActiveError,
    }),
    [],
  );

  return {
    accounts,
    activeAccountId,
    dir,
    setDir,
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    setDebouncedQuery,
    dailyQuota,
    lastSyncedAt,
    messages,
    nextCursor,
    hasMore,
    selectedMessageId,
    messageDetail,
    listLoading,
    loadingMore,
    detailLoading,
    deleting,
    savingAttachmentId,
    pendingDelete,
    activeError,
    mutators,
  };
}
