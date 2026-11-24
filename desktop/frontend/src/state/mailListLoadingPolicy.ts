import type { RemoteBackfillEligibility } from "./mailListBackfillPolicy.ts";

export const SEARCH_RELOAD_DEBOUNCE_MS = 120;

export function formatListScopeKey(
  accountId: string | null,
  ctx: RemoteBackfillEligibility,
): string {
  return [
    accountId ?? "all",
    ctx.activeFolder,
    ctx.activeLabelId ?? "",
    ctx.filterTab,
    ctx.searchQuery.trim(),
    ctx.advSearch.from,
    ctx.advSearch.to,
    ctx.advSearch.subject,
    ctx.advSearch.hasAttachment ? "1" : "0",
    ctx.advSearch.dateRange,
  ].join("|");
}

export type MailListViewPhase =
  "no-accounts" | "loading" | "error" | "empty" | "ready";

export type MailReaderViewPhase = "no-accounts" | "loading" | "empty" | "ready";

// 切换账号/文件夹/标签/筛选 Tab 时立即请求，仅在搜索关键词变动时保留输入防抖。
export function getListReloadDelayMs(
  prevSearchQuery: string,
  nextSearchQuery: string,
): number {
  return prevSearchQuery !== nextSearchQuery ? SEARCH_RELOAD_DEBOUNCE_MS : 0;
}

export function resolveMailListViewPhase(params: {
  accountCount: number;
  isInitialLoading: boolean;
  listError: string;
  itemCount: number;
}): MailListViewPhase {
  if (params.accountCount === 0) return "no-accounts";
  if (params.isInitialLoading) return "loading";
  if (params.listError && params.itemCount === 0) return "error";
  if (params.itemCount === 0) return "empty";
  return "ready";
}

export function resolveReaderViewPhase(params: {
  accountCount: number;
  isInitialLoading: boolean;
  hasSelectedMail: boolean;
}): MailReaderViewPhase {
  if (params.hasSelectedMail) return "ready";
  if (params.accountCount === 0) return "no-accounts";
  if (params.isInitialLoading) return "loading";
  return "empty";
}
