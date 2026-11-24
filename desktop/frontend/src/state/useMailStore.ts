import { useCallback, useMemo, useState } from "react";
import { INITIAL_MAILS } from "../data/mails";
import type { FolderId, MailFilterTab, MailItem } from "../types/mail";
import {
  EMPTY_ADV_SEARCH,
  buildBackendSearchQuery,
  filterMailList,
  type AdvancedSearchCriteria,
} from "./mailFilter";
import { formatListScopeKey } from "./mailListLoadingPolicy";
import { previewMail, shouldReloadOnMailDelta } from "./mailReadingPolicy";
import { isWailsDesktop } from "./storageHelpers";
import { useMailLabels } from "./useMailLabels";
import { useMailMutations } from "./useMailMutations";
import { useMailPages } from "./useMailPages";
import { useMailReaderEffects } from "./useMailReaderEffects";

export type { AdvancedSearchCriteria };

export function useMailStore(blockRemoteImages: boolean) {
  const [mails, setMails] = useState<MailItem[]>(() =>
    isWailsDesktop() ? [] : INITIAL_MAILS,
  );
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
  const labelActions = useMailLabels(mails, setMails, setActiveLabelId);

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

  const backfillCtx = useMemo(
    () => ({ activeFolder, activeLabelId, filterTab, searchQuery, advSearch }),
    [activeFolder, activeLabelId, advSearch, filterTab, searchQuery],
  );
  const {
    listArrivals: { deferMailDelta, ...listScroll },
    loaded,
    refreshCounts,
    resetPages,
    ...pageFields
  } = useMailPages(buildQuery, activeAccountId, backfillCtx, mails, setMails);
  const { reloadMessages } = pageFields;
  const [demoRead, setDemoRead] = useState<{
    scope: typeof buildQuery;
    ids: Set<string>;
  }>();
  const rememberRead = useCallback(
    (ids: string[]) => {
      if (isWailsDesktop() || filterTab !== "unread") return;
      setDemoRead((previous) => ({
        scope: buildQuery,
        ids: new Set([
          ...(previous?.scope === buildQuery ? previous.ids : []),
          ...ids,
        ]),
      }));
    },
    [buildQuery, filterTab],
  );
  const refreshAfterMailDelta = (addedIds: readonly string[] = []) => {
    const wouldReload = shouldReloadOnMailDelta(filterTab);
    if (deferMailDelta(addedIds, mails, wouldReload) || !wouldReload)
      void refreshCounts();
    else void reloadMessages();
  };
  const refreshUnreadView = useCallback(() => {
    if (filterTab !== "unread") return;
    setDemoRead(undefined);
    void reloadMessages();
  }, [filterTab, reloadMessages]);

  const filteredMails = isWailsDesktop()
    ? loaded
      ? mails
      : []
    : filterMailList({
        mails,
        searchQuery,
        activeFolder,
        activeAccountId,
        activeLabelId,
        filterTab,
        advSearch,
        readInView: demoRead?.scope === buildQuery ? demoRead.ids : undefined,
      });

  const selectedMail = previewMail(
    isWailsDesktop() && !loaded ? [] : mails,
    filteredMails,
    selectedMailId,
  );
  useMailReaderEffects(selectedMail, blockRemoteImages, setMails);
  const mutations = useMailMutations(
    mails,
    setMails,
    setCheckedIds,
    setSelectedMailId,
    activeFolder,
    refreshCounts,
    rememberRead,
  );

  const resetMailState = useCallback(() => {
    setMails(isWailsDesktop() ? [] : INITIAL_MAILS);
    resetPages();
    setActiveFolder("inbox");
    setActiveAccountId(null);
    setActiveLabelId(null);
    setSearchQuery("");
    setFilterTab("all");
    setAdvSearch(EMPTY_ADV_SEARCH);
    setSelectedMailId("");
    setDemoRead(undefined);
    setCheckedIds([]);
    void labelActions.reloadLabels();
  }, [labelActions, resetPages]);

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
    ...pageFields,
    listScopeKey: formatListScopeKey(activeAccountId, backfillCtx),
    refreshAfterMailDelta,
    refreshUnreadView,
    resetMailState,
    filteredMails,
    selectedMail,
    explicitlyOpened: selectedMail?.id === selectedMailId,
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
    listScope: buildQuery,
    listScroll,
    checkedIds,
    selectFolder,
    selectAccount,
    setAccountFilter,
    selectLabel,
    ...mutations,
    ...labelActions,
  };
}
