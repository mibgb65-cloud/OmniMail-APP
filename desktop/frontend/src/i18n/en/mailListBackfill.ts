import type { mailListBackfill as zhMailListBackfill } from "../zh/mailListBackfill.ts";

export const mailListBackfill = {
  loadingMore: "Loading more emails…",
  loadingRemoteOlder: "Loading earlier emails from server…",
  loadingRemoteOlderProgress:
    "Loading earlier emails from server ({synced} / {total} synced)…",
  remoteMoreAvailable: "Earlier emails available on server",
  remoteMoreAvailableCount:
    "{remaining, plural, one {About # earlier email on server} other {About # earlier emails on server}}",
  loadOlderBtn: "Load earlier",
  loadMoreFailed: "Couldn't load earlier emails ({reason})",
  retryLoadMoreBtn: "Retry",
  allMailsLoaded:
    "{count, plural, one {All # email loaded} other {All # emails loaded}}",
  loadingEmailsSubtitle: "Loading emails…",
  loadingListAria: "Loading email list",
  loadListFailedTitle: "Couldn't load email list",
  readerLoadingAria: "Loading email content",
} satisfies typeof zhMailListBackfill;
