import { useCallback, useMemo, useState } from "react";
import { INITIAL_MAILS } from "../data/mails";
import type { FolderId, MailFilterTab, MailItem } from "../types/mail";
import {
  EMPTY_ADV_SEARCH,
  filterMailList,
  type AdvancedSearchCriteria,
} from "./mailFilter";
import { useMailLabels } from "./useMailLabels";

export type { AdvancedSearchCriteria };

export function useMailStore() {
  const [mails, setMails] = useState<MailItem[]>(INITIAL_MAILS);
  const [activeFolder, setActiveFolder] = useState<FolderId>("inbox");
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<MailFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [advSearch, setAdvSearch] =
    useState<AdvancedSearchCriteria>(EMPTY_ADV_SEARCH);
  const [selectedMailId, setSelectedMailId] = useState<string>("mail-1");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const labelActions = useMailLabels(setMails, setActiveLabelId);

  const filteredMails = useMemo(
    () =>
      filterMailList({
        mails,
        searchQuery,
        activeFolder,
        activeAccountId,
        activeLabelId,
        filterTab,
        advSearch,
      }),
    [
      mails,
      searchQuery,
      activeFolder,
      activeAccountId,
      activeLabelId,
      filterTab,
      advSearch,
    ],
  );

  const selectedMail = useMemo(
    () =>
      mails.find((m) => m.id === selectedMailId) ?? filteredMails[0] ?? null,
    [mails, selectedMailId, filteredMails],
  );

  const selectFolder = useCallback((folder: FolderId) => {
    setActiveFolder(folder);
    setActiveLabelId(null);
    setSearchQuery("");
    setCheckedIds([]);
  }, []);

  const selectAccount = useCallback((accountId: string | null) => {
    setActiveAccountId((prev) => (prev === accountId ? null : accountId));
    setCheckedIds([]);
  }, []);

  const setAccountFilter = useCallback((accountId: string | null) => {
    setActiveAccountId(accountId);
    setCheckedIds([]);
  }, []);

  const selectLabel = useCallback((labelId: string) => {
    setActiveLabelId((prev) => (prev === labelId ? null : labelId));
    setSearchQuery("");
    setCheckedIds([]);
  }, []);

  const openMail = useCallback((mailId: string) => {
    setSelectedMailId(mailId);
    setMails((prev) =>
      prev.map((m) => (m.id === mailId ? { ...m, unread: false } : m)),
    );
  }, []);

  const toggleStar = useCallback((mailIds: string[]) => {
    setMails((prev) =>
      prev.map((m) =>
        mailIds.includes(m.id) ? { ...m, starred: !m.starred } : m,
      ),
    );
  }, []);

  const markRead = useCallback((mailIds: string[], unread: boolean) => {
    setMails((prev) =>
      prev.map((m) => (mailIds.includes(m.id) ? { ...m, unread } : m)),
    );
  }, []);

  const moveMails = useCallback(
    (mailIds: string[], target: FolderId, extra?: Partial<MailItem>) => {
      setMails((prev) =>
        prev.map((m) =>
          mailIds.includes(m.id) ? { ...m, folder: target, ...extra } : m,
        ),
      );
      setCheckedIds((prev) => prev.filter((id) => !mailIds.includes(id)));
    },
    [],
  );

  const permanentDelete = useCallback((mailIds: string[]) => {
    setMails((prev) => prev.filter((m) => !mailIds.includes(m.id)));
    setCheckedIds((prev) => prev.filter((id) => !mailIds.includes(id)));
  }, []);

  const emptyTrash = useCallback(() => {
    setMails((prev) => prev.filter((m) => m.folder !== "trash"));
    setCheckedIds([]);
  }, []);

  const toggleChecked = useCallback((mailId: string) => {
    setCheckedIds((prev) =>
      prev.includes(mailId)
        ? prev.filter((id) => id !== mailId)
        : [...prev, mailId],
    );
  }, []);

  const clearChecked = useCallback(() => setCheckedIds([]), []);

  const updateMail = useCallback((mailId: string, patch: Partial<MailItem>) => {
    setMails((prev) =>
      prev.map((m) => (m.id === mailId ? { ...m, ...patch } : m)),
    );
  }, []);

  const addMail = useCallback((item: MailItem) => {
    setMails((prev) => [item, ...prev]);
    setSelectedMailId(item.id);
  }, []);

  return {
    mails,
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
    toggleChecked,
    clearChecked,
    selectFolder,
    selectAccount,
    setAccountFilter,
    selectLabel,
    openMail,
    toggleStar,
    markRead,
    moveMails,
    permanentDelete,
    emptyTrash,
    updateMail,
    addMail,
    ...labelActions,
  };
}
