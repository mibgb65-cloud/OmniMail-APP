import { useEffect } from "react";
import { workBuddyMailApi } from "../services/backendClient";
import type { WorkspaceScreen } from "../types/ui";
import type {
  WorkBuddyAccount,
  WorkBuddyDirection,
  WorkBuddyMessageSummary,
} from "../types/workbuddy";
import {
  runFetchMessagesPage,
  runSelectAndMarkRead,
  type WorkBuddyStateMutators,
} from "./workBuddyStoreActions";

export function useWorkBuddySyncEffects(params: {
  activeProfileId: string;
  screen: WorkspaceScreen;
  activeAccount: WorkBuddyAccount | undefined;
  dir: WorkBuddyDirection;
  searchQuery: string;
  debouncedQuery: string;
  setDebouncedQuery: (q: string) => void;
  selectedMessageId: string;
  detailMessageId: string | undefined;
  messages: WorkBuddyMessageSummary[];
  mutators: WorkBuddyStateMutators;
}) {
  const {
    activeProfileId,
    screen,
    activeAccount,
    dir,
    searchQuery,
    debouncedQuery,
    setDebouncedQuery,
    selectedMessageId,
    detailMessageId,
    messages,
    mutators,
  } = params;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery, setDebouncedQuery]);

  useEffect(() => {
    let alive = true;
    void workBuddyMailApi
      .getStatusAndAliases("")
      .then((res) => {
        if (!alive) return;
        mutators.setAccounts(res.accounts);
        mutators.setActiveAccountId(
          res.activeAccount?.accountId ?? res.accounts[0]?.accountId ?? "",
        );
        if (res.dailyQuota.hasQuota) mutators.setDailyQuota(res.dailyQuota);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [activeProfileId, mutators]);

  useEffect(() => {
    if (screen !== "workbuddy" || !activeAccount) return;
    void runFetchMessagesPage(mutators, {
      account: activeAccount,
      dir,
      query: debouncedQuery,
      cursor: "",
      append: false,
    });
  }, [activeAccount, debouncedQuery, dir, mutators, screen]);

  useEffect(() => {
    if (screen !== "workbuddy" || !activeAccount || !selectedMessageId) return;
    if (detailMessageId === selectedMessageId) return;
    const item = messages.find((m) => m.messageId === selectedMessageId);
    void runSelectAndMarkRead(
      mutators,
      activeAccount,
      selectedMessageId,
      Boolean(item && !item.isRead),
    );
  }, [
    activeAccount,
    detailMessageId,
    messages,
    mutators,
    screen,
    selectedMessageId,
  ]);
}
