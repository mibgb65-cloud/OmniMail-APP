import { useCallback, useMemo } from "react";
import { t } from "../i18n";
import { workBuddyMailApi } from "../services/backendClient";
import type { WorkspaceScreen } from "../types/ui";
import type { WorkBuddyAccount } from "../types/workbuddy";
import {
  resetAllWorkBuddyState,
  useWorkBuddyStateCells,
  type WorkBuddyToastFn,
} from "./useWorkBuddyState";
import { useWorkBuddySyncEffects } from "./workBuddyStoreEffects";
import { createWorkBuddyHandlers } from "./workBuddyStoreHandlers";

export function useWorkBuddyStore(
  activeProfileId: string,
  screen: WorkspaceScreen,
  setScreen: (next: WorkspaceScreen) => void,
  pushToast: WorkBuddyToastFn,
) {
  const s = useWorkBuddyStateCells();
  const { mutators: m } = s;

  const activeAccount = useMemo(
    () =>
      s.accounts.find((a) => a.accountId === s.activeAccountId) ??
      s.accounts[0],
    [s.accounts, s.activeAccountId],
  );

  useWorkBuddySyncEffects({
    activeProfileId,
    screen,
    activeAccount,
    dir: s.dir,
    searchQuery: s.searchQuery,
    debouncedQuery: s.debouncedQuery,
    setDebouncedQuery: s.setDebouncedQuery,
    selectedMessageId: s.selectedMessageId,
    detailMessageId: s.messageDetail?.messageId,
    messages: s.messages,
    mutators: m,
  });

  const selectAccount = useCallback(
    (accountId: string) => {
      if (accountId !== activeAccount?.accountId) {
        m.setMessages([]);
        m.setSelectedMessageId("");
        m.setMessageDetail(null);
        m.setListLoading(true);
      }
      m.setActiveAccountId(accountId);
      setScreen("workbuddy");
    },
    [activeAccount?.accountId, m, setScreen],
  );

  const applyConnectedAccount = useCallback(
    (acc: WorkBuddyAccount) => {
      m.setAccounts((prev) => {
        const idx = prev.findIndex((x) => x.accountId === acc.accountId);
        return idx >= 0
          ? prev.map((x, i) => (i === idx ? acc : x))
          : [...prev, acc];
      });
      m.setMessages([]);
      m.setSelectedMessageId("");
      m.setMessageDetail(null);
      m.setActiveAccountId(acc.accountId);
      if (acc.dailyQuota.hasQuota) m.setDailyQuota(acc.dailyQuota);
      setScreen("workbuddy");
    },
    [m, setScreen],
  );

  const disconnectAccount = useCallback(
    async (accountId: string) => {
      const target = s.accounts.find((a) => a.accountId === accountId);
      await workBuddyMailApi.disconnectAccount(accountId);
      const remaining = s.accounts.filter((a) => a.accountId !== accountId);
      m.setAccounts(remaining);
      if (target) {
        pushToast({
          tone: "info",
          title: t("workbuddy.disconnectedToast", { email: target.email }),
        });
      }
      if (remaining.length === 0) resetAllWorkBuddyState(m, screen, setScreen);
      else if (activeAccount?.accountId === accountId) {
        selectAccount(remaining[0].accountId);
      }
    },
    [
      activeAccount?.accountId,
      m,
      pushToast,
      s.accounts,
      screen,
      selectAccount,
      setScreen,
    ],
  );

  const handlers = createWorkBuddyHandlers(
    s,
    activeAccount,
    screen,
    setScreen,
    pushToast,
  );

  return {
    accounts: s.accounts,
    activeAccount,
    dir: s.dir,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    dailyQuota: s.dailyQuota,
    lastSyncedAt: s.lastSyncedAt,
    messages: s.messages,
    hasMore: s.hasMore,
    selectedMessageId: s.selectedMessageId,
    messageDetail: s.messageDetail,
    listLoading: s.listLoading,
    loadingMore: s.loadingMore,
    detailLoading: s.detailLoading,
    deleting: s.deleting,
    savingAttachmentId: s.savingAttachmentId,
    pendingDelete: s.pendingDelete,
    activeError: s.activeError,
    selectAccount,
    applyConnectedAccount,
    disconnectAccount,
    ...handlers,
  };
}
