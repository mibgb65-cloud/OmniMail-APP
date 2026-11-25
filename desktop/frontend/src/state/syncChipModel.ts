import {
  isSyncLabelActive,
  localizeBuiltinText,
  translateWithLang,
} from "../i18n/index.ts";
import type { EmailAccount } from "../types/account.ts";
import type { LanguageCode } from "../types/settings.ts";
import type { RuntimeBannerMode } from "../types/ui.ts";
import {
  deriveAccountSyncState,
  type SyncChipTone,
} from "./accountSyncState.ts";
import type { ViewportMode } from "./useViewportMode.ts";

export interface SyncChipModel {
  tone: SyncChipTone;
  text: string;
  showChevron: boolean;
  opensPopover: boolean;
}

export function buildSyncChipModel(params: {
  accounts: readonly EmailAccount[];
  bannerMode: RuntimeBannerMode;
  syncLabel: string;
  viewport: ViewportMode;
  showJustDone: boolean;
  lang: LanguageCode;
}): SyncChipModel {
  const { accounts, bannerMode, syncLabel, viewport, showJustDone, lang } =
    params;
  const isCompact = viewport === "compact";
  const isLaptop = viewport === "laptop";

  if (accounts.length === 0) {
    return {
      tone: "empty",
      text: translateWithLang(lang, "topbar.noAccount"),
      showChevron: false,
      opensPopover: false,
    };
  }

  const derived = deriveAccountSyncState(accounts);
  const activelySyncing =
    isSyncLabelActive(syncLabel) || derived.syncingAccounts.length > 0;

  if (activelySyncing) {
    const fallback = translateWithLang(lang, "topbar.syncingEllipsis");
    return {
      tone: "syncing",
      text: isCompact
        ? translateWithLang(lang, "topbar.syncingShort")
        : isSyncLabelActive(syncLabel)
          ? localizeBuiltinText(syncLabel, lang)
          : fallback,
      showChevron: derived.hasIssues,
      opensPopover: derived.hasIssues,
    };
  }

  if (bannerMode === "offline") {
    return {
      tone: "offline",
      text: isCompact
        ? translateWithLang(lang, "topbar.offlineShort")
        : translateWithLang(lang, "topbar.offlineCached"),
      showChevron: false,
      opensPopover: false,
    };
  }

  if (derived.authExpiredAccounts.length > 0) {
    const count = derived.authExpiredAccounts.length;
    return {
      tone: "danger",
      text: isCompact
        ? translateWithLang(lang, "topbar.chipAuthShort", { count })
        : translateWithLang(lang, "topbar.chipAuthExpiredCount", { count }),
      showChevron: true,
      opensPopover: true,
    };
  }

  if (derived.errorAccounts.length > 0) {
    const count = derived.errorAccounts.length;
    return {
      tone: "warning",
      text: isCompact
        ? translateWithLang(lang, "topbar.chipBlockedShort", { count })
        : translateWithLang(lang, "topbar.chipBlockedCount", { count }),
      showChevron: true,
      opensPopover: true,
    };
  }

  if (showJustDone) {
    return {
      tone: "done",
      text: isCompact
        ? translateWithLang(lang, "topbar.syncedShort")
        : translateWithLang(lang, "topbar.allSyncedDone"),
      showChevron: false,
      opensPopover: false,
    };
  }

  return {
    tone: "healthy",
    text: isCompact
      ? translateWithLang(lang, "topbar.syncedShort")
      : isLaptop
        ? translateWithLang(lang, "topbar.accountsSyncedCount", {
            count: accounts.length,
          })
        : translateWithLang(lang, "topbar.allAccountsSynced"),
    showChevron: false,
    opensPopover: false,
  };
}
