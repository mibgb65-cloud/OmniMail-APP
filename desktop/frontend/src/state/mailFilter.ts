import type { FolderId, MailFilterTab, MailItem } from "../types/mail";

export interface AdvancedSearchCriteria {
  from: string;
  to: string;
  subject: string;
  accountId: string;
  hasAttachment: boolean;
  dateRange: "all" | "7d" | "30d" | "90d";
}

export const EMPTY_ADV_SEARCH: AdvancedSearchCriteria = {
  from: "",
  to: "",
  subject: "",
  accountId: "all",
  hasAttachment: false,
  dateRange: "all",
};

interface FilterMailParams {
  mails: MailItem[];
  searchQuery: string;
  activeFolder: FolderId;
  activeAccountId: string | null;
  activeLabelId: string | null;
  filterTab: MailFilterTab;
  advSearch: AdvancedSearchCriteria;
}

export function filterMailList({
  mails,
  searchQuery,
  activeFolder,
  activeAccountId,
  activeLabelId,
  filterTab,
  advSearch,
}: FilterMailParams): MailItem[] {
  const q = searchQuery.trim().toLowerCase();
  return mails.filter((m) => {
    if (q) {
      const hit =
        m.subject.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.senderEmail.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q) ||
        m.attachments.some((a) => a.name.toLowerCase().includes(q));
      if (!hit) return false;
    } else if (activeLabelId) {
      if (!m.labels.includes(activeLabelId)) return false;
    } else if (activeFolder === "starred") {
      if (!m.starred || m.folder === "trash" || m.folder === "spam")
        return false;
    } else if (m.folder !== activeFolder) {
      return false;
    }

    if (activeAccountId && m.accountId !== activeAccountId) return false;
    if (advSearch.accountId !== "all" && m.accountId !== advSearch.accountId) {
      return false;
    }
    if (
      advSearch.from &&
      !`${m.senderName} ${m.senderEmail}`
        .toLowerCase()
        .includes(advSearch.from.toLowerCase())
    ) {
      return false;
    }
    if (
      advSearch.subject &&
      !m.subject.toLowerCase().includes(advSearch.subject.toLowerCase())
    ) {
      return false;
    }
    if (advSearch.hasAttachment && m.attachments.length === 0) return false;
    if (filterTab === "unread" && !m.unread) return false;
    if (filterTab === "starred" && !m.starred) return false;
    if (filterTab === "attachments" && m.attachments.length === 0) return false;
    return true;
  });
}
