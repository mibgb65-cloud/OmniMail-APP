import type { FolderId, MailFilterTab, MailItem } from "../types/mail.ts";
import type { AdvancedSearchCriteria } from "./mailFilter.ts";

const REMOTE_BACKFILL_FOLDERS = new Set<FolderId>([
  "inbox",
  "sent",
  "drafts",
  "archive",
  "spam",
  "trash",
]);

export interface RemoteBackfillEligibility {
  activeFolder: FolderId;
  activeLabelId: string | null;
  filterTab: MailFilterTab;
  searchQuery: string;
  advSearch: AdvancedSearchCriteria;
}

export function hasActiveSearchCriteria(
  searchQuery: string,
  advSearch: AdvancedSearchCriteria,
): boolean {
  return Boolean(
    searchQuery.trim() ||
    advSearch.from.trim() ||
    advSearch.to.trim() ||
    advSearch.subject.trim() ||
    advSearch.hasAttachment ||
    advSearch.dateRange !== "all",
  );
}

export function canBackfillRemoteFolder(
  ctx: RemoteBackfillEligibility,
  manual = false,
): boolean {
  if (!REMOTE_BACKFILL_FOLDERS.has(ctx.activeFolder)) return false;
  if (ctx.activeLabelId !== null) return false;
  if (hasActiveSearchCriteria(ctx.searchQuery, ctx.advSearch)) return false;
  if (!manual && ctx.filterTab !== "all") return false;
  return true;
}

export function buildTailMailCursor(
  mails: readonly Pick<MailItem, "id" | "receivedAtUnixMs">[],
): string {
  const tail = mails[mails.length - 1];
  if (!tail || !tail.id || !tail.receivedAtUnixMs) return "";
  return `${tail.receivedAtUnixMs}:${tail.id}`;
}

export function mergeOlderMailItems<T extends { id: string }>(
  prev: readonly T[],
  incoming: readonly T[],
): T[] {
  if (incoming.length === 0) return [...prev];
  const existing = new Set(prev.map((item) => item.id));
  const appended = incoming.filter((item) => !existing.has(item.id));
  return appended.length === 0 ? [...prev] : [...prev, ...appended];
}

export type MailListFooterKind =
  "none" | "local-loading" | "remote-loading" | "error" | "manual-more" | "end";

export function resolveMailListFooterKind(state: {
  loadingMore: boolean;
  loadingRemoteOlder: boolean;
  loadMoreError: string;
  hasMore: boolean;
  hasRemoteMore: boolean;
  loadedCount: number;
  canManualBackfill: boolean;
}): MailListFooterKind {
  if (state.loadingRemoteOlder) return "remote-loading";
  if (state.loadingMore) return "local-loading";
  if (state.loadMoreError) return "error";
  if (!state.hasMore && state.hasRemoteMore && state.canManualBackfill) {
    return "manual-more";
  }
  if (!state.hasMore && !state.hasRemoteMore && state.loadedCount > 0) {
    return "end";
  }
  return "none";
}
