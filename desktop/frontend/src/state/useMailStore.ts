import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_MAILS } from "../data/mails";
import { mailApi } from "../services/backendClient";
import type { FolderId, MailFilterTab, MailItem } from "../types/mail";
import {
  EMPTY_ADV_SEARCH,
  buildBackendSearchQuery,
  filterMailList,
  type AdvancedSearchCriteria,
} from "./mailFilter";
import { isWailsDesktop } from "./storageHelpers";
import { useMailLabels } from "./useMailLabels";
import { useMailMutations } from "./useMailMutations";
import { useMailReaderEffects } from "./useMailReaderEffects";

export type { AdvancedSearchCriteria };

export function useMailStore() {
  const [mails, setMails] = useState<MailItem[]>(() =>
    isWailsDesktop() ? [] : INITIAL_MAILS,
  );
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState("");
  const [activeFolder, setActiveFolder] = useState<FolderId>("inbox");
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<MailFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [advSearch, setAdvSearch] =
    useState<AdvancedSearchCriteria>(EMPTY_ADV_SEARCH);
  const [selectedMailId, setSelectedMailId] = useState<string>(() =>
    isWailsDesktop() ? "" : "mail-1",
  );
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const reqSeqRef = useRef(0);

  const labelActions = useMailLabels(mails, setMails, setActiveLabelId);

  const refreshCounts = useCallback(async () => {
    const counts = await mailApi
      .getFolderCounts(activeAccountId ?? "")
      .catch(() => ({}));
    setFolderCounts(counts);
  }, [activeAccountId]);

  const buildQuery = useCallback(
    (cursor = "") =>
      buildBackendSearchQuery(
        {
          searchQuery,
          activeFolder,
          activeAccountId,
          activeLabelId,
          filterTab,
          advSearch,
        },
        cursor,
      ),
    [
      activeAccountId,
      activeFolder,
      activeLabelId,
      advSearch,
      filterTab,
      searchQuery,
    ],
  );

  const reloadMessages = useCallback(async () => {
    if (!isWailsDesktop()) return;
    const seq = ++reqSeqRef.current;
    const [page] = await Promise.all([
      mailApi
        .listMessages(buildQuery())
        .catch(() => ({ items: [], nextCursor: "", totalCount: 0 })),
      refreshCounts(),
    ]);
    if (seq !== reqSeqRef.current) return;
    setMails(page.items);
    setNextCursor(page.nextCursor);
    setTotalCount(page.totalCount);
    if (
      page.items.length > 0 &&
      !page.items.some((m) => m.id === selectedMailId)
    ) {
      setSelectedMailId(page.items[0].id);
    }
  }, [buildQuery, refreshCounts, selectedMailId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reloadMessages(), 60);
    return () => window.clearTimeout(timer);
  }, [reloadMessages]);

  const loadMore = useCallback(async () => {
    if (!isWailsDesktop() || !nextCursor) return;
    const page = await mailApi
      .listMessages(buildQuery(nextCursor))
      .catch(() => null);
    if (!page) return;
    setMails((p) => [
      ...p,
      ...page.items.filter((i) => !p.some((x) => x.id === i.id)),
    ]);
    setNextCursor(page.nextCursor);
  }, [buildQuery, nextCursor]);

  const filteredMails = isWailsDesktop()
    ? mails
    : filterMailList({
        mails,
        searchQuery,
        activeFolder,
        activeAccountId,
        activeLabelId,
        filterTab,
        advSearch,
      });

  const selectedMail =
    mails.find((m) => m.id === selectedMailId) ?? filteredMails[0] ?? null;

  useMailReaderEffects(selectedMail, setMails, refreshCounts);
  const mutations = useMailMutations(
    mails,
    setMails,
    setCheckedIds,
    setSelectedMailId,
    activeFolder,
    refreshCounts,
  );

  const resetMailState = useCallback(() => {
    setMails(isWailsDesktop() ? [] : INITIAL_MAILS);
    setFolderCounts({});
    setActiveFolder("inbox");
    setActiveAccountId(null);
    setActiveLabelId(null);
    setSearchQuery("");
    setCheckedIds([]);
    void labelActions.reloadLabels();
    void reloadMessages();
  }, [labelActions, reloadMessages]);

  const selectFolder = (f: FolderId) => {
    setActiveFolder(f);
    setActiveLabelId(null);
    setSearchQuery("");
    setCheckedIds([]);
  };
  const selectAccount = (id: string | null) => {
    setActiveAccountId((p) => (p === id ? null : id));
    setCheckedIds([]);
  };
  const setAccountFilter = (id: string | null) => {
    setActiveAccountId(id);
    setCheckedIds([]);
  };
  const selectLabel = (id: string) => {
    setActiveLabelId((p) => (p === id ? null : id));
    setSearchQuery("");
    setCheckedIds([]);
  };

  return {
    mails,
    setMails,
    folderCounts,
    setFolderCounts,
    totalCount,
    hasMore: Boolean(nextCursor),
    loadMore,
    reloadMessages,
    resetMailState,
    filteredMails,
    selectedMail,
    activeFolder,
    activeAccountId,
    activeLabelId,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    advSearch,
    setAdvSearch,
    resetAdvSearch: () => setAdvSearch(EMPTY_ADV_SEARCH),
    checkedIds,
    selectFolder,
    selectAccount,
    setAccountFilter,
    selectLabel,
    ...mutations,
    ...labelActions,
  };
}
