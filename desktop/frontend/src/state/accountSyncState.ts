import {
  formatLocalizedTime,
  isSyncLabelActive,
  localizeBuiltinText,
  translateWithLang,
} from "../i18n/index.ts";
import type { EmailAccount } from "../types/account.ts";
import type { LanguageCode } from "../types/settings.ts";
import type { OverlayModal, RuntimeBannerMode } from "../types/ui.ts";
import type { LiveSyncProgress } from "./syncProgress.ts";

export type SyncChipTone =
  "empty" | "syncing" | "done" | "offline" | "danger" | "warning" | "healthy";

export interface DerivedAccountSyncState {
  errorAccounts: EmailAccount[];
  authExpiredAccounts: EmailAccount[];
  issueAccounts: EmailAccount[];
  syncingAccounts: EmailAccount[];
  healthyAccounts: EmailAccount[];
  hasIssues: boolean;
  allHealthy: boolean;
}

export function normalizeAccountRuntimeStatus(
  raw: string | undefined,
): EmailAccount["status"] {
  if (raw === "syncing" || raw === "auth-expired" || raw === "error") {
    return raw;
  }
  return "connected";
}

export function deriveAccountSyncState(
  accounts: readonly EmailAccount[],
): DerivedAccountSyncState {
  const authExpiredAccounts = accounts.filter(
    (a) => a.status === "auth-expired",
  );
  const errorAccounts = accounts.filter((a) => a.status === "error");
  const syncingAccounts = accounts.filter((a) => a.status === "syncing");
  const healthyAccounts = accounts.filter((a) => a.status === "connected");
  const issueAccounts = [...authExpiredAccounts, ...errorAccounts];
  return {
    errorAccounts,
    authExpiredAccounts,
    issueAccounts,
    syncingAccounts,
    healthyAccounts,
    hasIssues: issueAccounts.length > 0,
    allHealthy:
      accounts.length > 0 &&
      issueAccounts.length === 0 &&
      syncingAccounts.length === 0,
  };
}

export function canTriggerManualSync(
  accounts: readonly EmailAccount[],
  manualSyncPending: boolean,
): boolean {
  if (accounts.length === 0 || manualSyncPending) return false;
  return deriveAccountSyncState(accounts).syncingAccounts.length === 0;
}

export function resolveIdleSyncLabel(
  accounts: readonly EmailAccount[],
  lang: LanguageCode,
): string {
  const { hasIssues } = deriveAccountSyncState(accounts);
  return translateWithLang(
    lang,
    hasIssues ? "topbar.syncPartialFailed" : "topbar.allAccountsSynced",
  );
}

export function buildAccountStatusPatch(
  payload: { accountId: string; status: string; lastError?: string },
  lang: LanguageCode,
): Partial<EmailAccount> {
  const status = normalizeAccountRuntimeStatus(payload.status);
  const nowLabel = formatLocalizedTime("刚刚", lang);
  if (status === "connected") {
    return { status: "connected", lastError: "", lastSyncedAt: nowLabel };
  }
  if (status === "syncing") {
    return { status: "syncing" };
  }
  return {
    status,
    lastError: (payload.lastError ?? "").trim(),
    lastSyncedAt: nowLabel,
  };
}

export function applyAccountStatusToList(
  accounts: readonly EmailAccount[],
  payload: { accountId: string; status: string; lastError?: string },
  lang: LanguageCode,
): EmailAccount[] {
  const patch = buildAccountStatusPatch(payload, lang);
  return accounts.map((acc) =>
    acc.id === payload.accountId ? { ...acc, ...patch } : acc,
  );
}

export function applySyncProgressToAccounts(
  accounts: readonly EmailAccount[],
  progress: Pick<LiveSyncProgress, "accountId" | "status">,
  lang: LanguageCode,
): EmailAccount[] {
  const nowLabel = formatLocalizedTime("刚刚", lang);
  return accounts.map((acc) => {
    if (acc.id !== progress.accountId) return acc;
    if (progress.status === "syncing") {
      return acc.status === "syncing" ? acc : { ...acc, status: "syncing" };
    }
    if (acc.status !== "syncing") return acc;
    if (progress.status === "done") {
      return {
        ...acc,
        status: "connected",
        lastError: "",
        lastSyncedAt: nowLabel,
      };
    }
    return { ...acc, status: "error", lastSyncedAt: nowLabel };
  });
}

export function reconcileRuntimeSyncState(params: {
  accounts: readonly EmailAccount[];
  bannerMode: RuntimeBannerMode;
  syncLabel: string;
  lang: LanguageCode;
  manualSyncPending?: boolean;
}): { nextBannerMode: RuntimeBannerMode; nextSyncLabel: string } {
  const { authExpiredAccounts, syncingAccounts } = deriveAccountSyncState(
    params.accounts,
  );

  let nextBannerMode = params.bannerMode;
  if (
    params.bannerMode === "partial-sync" ||
    (params.bannerMode === "auth-expired" && authExpiredAccounts.length === 0)
  ) {
    nextBannerMode = "none";
  }

  let nextSyncLabel = params.syncLabel;
  if (params.accounts.length > 0) {
    if (syncingAccounts.length > 0) {
      if (!isSyncLabelActive(params.syncLabel)) {
        nextSyncLabel = translateWithLang(
          params.lang,
          "topbar.syncingEllipsis",
        );
      }
    } else if (!params.manualSyncPending) {
      // 非手动同步等待期且所有账户均非 syncing 时，无条件收敛残留的同步中文案
      nextSyncLabel = resolveIdleSyncLabel(params.accounts, params.lang);
    }
  }

  return { nextBannerMode, nextSyncLabel };
}

export function resolveAccountActionOverlay(
  account: Pick<EmailAccount, "id" | "status" | "authMode" | "provider">,
  kind: "diagnostics" | "reauth",
): OverlayModal {
  if (kind === "diagnostics") {
    return { type: "diagnostics", accountId: account.id };
  }
  if (account.authMode === "oauth") {
    return { type: "oauth-flow", provider: account.provider, stage: "waiting" };
  }
  return { type: "account-server", accountId: account.id };
}

export function formatAccountSyncReason(
  account: Pick<EmailAccount, "status" | "lastError" | "imap">,
  lang: LanguageCode,
): string {
  const raw = (account.lastError ?? "").trim();
  if (raw) return localizeBuiltinText(raw, lang);
  if (account.status === "auth-expired") {
    return translateWithLang(lang, "topbar.popDefaultAuthReason");
  }
  return translateWithLang(lang, "topbar.popDefaultErrorReason", {
    port: account.imap?.port || 993,
  });
}
