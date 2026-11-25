import type { syncStatus as zhSyncStatus } from "../zh/syncStatus.ts";

export const syncStatus = {
  chipBlockedCount: "{count} account sync issue(s)",
  chipAuthExpiredCount: "{count} account(s) need re-auth",
  chipBlockedShort: "{count} issue",
  chipAuthShort: "{count} re-auth",
  chipOpenPopoverTip: "View account sync status & issue details",
  popTitle: "Account Sync Status",
  popSubtitle: "Anchored below top bar · Never pushes reading pane",
  popIssueBadge: "{count} issue(s)",
  popHealthyBadge: "All healthy",
  popRetryAll: "Retry all",
  popSyncAll: "Sync all",
  popCardBlockedMeta: "{email} · Sync blocked at {time}",
  popCardAuthMeta: "{email} · Auth expired at {time}",
  popTagError: "Disconnected",
  popTagAuthExpired: "Auth expired",
  popDefaultErrorReason:
    "Stage: IMAP server connection (port {port}) · Connection interrupted — run diagnostics",
  popDefaultAuthReason:
    "Stage: IMAP authentication · Credentials expired or revoked — re-authorize account",
  popAutoRetryHint:
    "Auto-retried twice with backoff — run diagnostics if issue persists",
  popAuthExpiredHint:
    "Local cached mail remains readable; re-authorize to resume live sync",
  popRunDiagnostics: "Run diagnostics",
  popRetryNow: "Retry now",
  popReauthorize: "Re-authorize",
  popHealthyOthers: "{count} other account(s) synced normally",
  popHealthyOthersWithSample: "{count} other account(s) healthy ({sample})",
  popAllHealthyTitle: "All accounts synced normally",
  popAllHealthySub:
    "All {count} connected account(s) are healthy with no sync or auth issues.",
  sidebarSubBlocked: "Sync issue · {time}",
  sidebarSubAuthExpired: "Re-auth · {time}",
  sidebarPillDiagnose: "Diagnose",
  sidebarPillReconnect: "Re-auth",
} satisfies typeof zhSyncStatus;
