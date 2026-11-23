import type { MailSearchQuery } from "../services/backendClient";
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

export function buildBackendSearchQuery(
  params: Omit<FilterMailParams, "mails">,
  cursor = "",
): MailSearchQuery {
  const accIds: string[] = [];
  if (params.activeAccountId) accIds.push(params.activeAccountId);
  else if (params.advSearch.accountId !== "all") {
    accIds.push(params.advSearch.accountId);
  }
  const kwParts = [
    params.searchQuery.trim(),
    params.advSearch.subject.trim(),
  ].filter(Boolean);
  let dateFrom = 0;
  if (params.advSearch.dateRange !== "all") {
    const days =
      params.advSearch.dateRange === "7d"
        ? 7
        : params.advSearch.dateRange === "30d"
          ? 30
          : 90;
    dateFrom = Date.now() - days * 86400 * 1000;
  }
  return {
    keyword: kwParts.join(" "),
    accountIds: accIds.length > 0 ? accIds : undefined,
    folder: params.activeLabelId ? "all" : params.activeFolder,
    tab: params.filterTab,
    from: params.advSearch.from.trim() || undefined,
    to: params.advSearch.to.trim() || undefined,
    hasAttachment: params.advSearch.hasAttachment ? true : undefined,
    labelIds: params.activeLabelId ? [params.activeLabelId] : undefined,
    dateFrom: dateFrom > 0 ? dateFrom : undefined,
    cursor: cursor || undefined,
    limit: 50,
  };
}
