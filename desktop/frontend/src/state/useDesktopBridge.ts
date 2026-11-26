import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentLanguage, isSyncLabelActive, t } from "../i18n";
import type { EmailAccount } from "../types/account";
import type { AppSettings, LanguageCode } from "../types/settings";
import type {
  OverlayModal,
  RuntimeBannerMode,
  WorkspaceScreen,
} from "../types/ui";
import {
  applyAccountStatusToList,
  applySyncProgressToAccounts,
  buildAccountStatusPatch,
  deriveAccountSyncState,
  normalizeAccountRuntimeStatus,
  resolveIdleSyncLabel,
} from "./accountSyncState";
import { useDesktopRuntimeEvents } from "./desktopActions";
import type { LiveSyncProgress } from "./syncProgress";
import {
  useDesktopBootstrap,
  useDesktopStorageOps,
} from "./useDesktopStorageOps";

interface BridgeDeps {
  accounts: EmailAccount[];
  manualSyncPending: boolean;
  syncLabel: string;
  settings: AppSettings;
  applySettingsFromBackend: (patch: Partial<AppSettings>) => void;
  setScreen: (screen: WorkspaceScreen) => void;
  setOverlay: (ov: OverlayModal) => void;
  setBannerMode: (mode: RuntimeBannerMode) => void;
  setSyncLabel: (label: string) => void;
  updateAccount: (id: string, patch: Partial<EmailAccount>) => void;
  refreshProfilesAndAccounts: () => Promise<{
    launchBehavior: "last-profile" | "ask-on-launch";
    requiresUnlock: boolean;
    accounts: EmailAccount[];
  }>;
  onResetStoresForSwitch: () => void;
  onMailDelta: (addedIds?: readonly string[]) => void;
  openNewCompose: (to?: string[]) => void;
  updateComposeDraft: (patch: { subject?: string; body?: string }) => void;
  pushToast: (n: {
    tone: "info" | "success" | "warning" | "danger";
    title: string;
    detail?: string;
  }) => void;
  onTraySyncAll: () => void;
}

export function useDesktopBridge(deps: BridgeDeps) {
  const storageOps = useDesktopStorageOps(
    deps.settings,
    deps.refreshProfilesAndAccounts,
  );
  const [syncProgressByAccount, setSyncProgressByAccount] = useState(
    () => new Map<string, LiveSyncProgress>(),
  );
  const runtimeRef = useRef({
    accounts: deps.accounts,
    manualSyncPending: deps.manualSyncPending,
    syncLabel: deps.syncLabel,
  });

  useEffect(() => {
    runtimeRef.current = {
      accounts: deps.accounts,
      manualSyncPending: deps.manualSyncPending,
      syncLabel: deps.syncLabel,
    };
  }, [deps.accounts, deps.manualSyncPending, deps.syncLabel]);

  const onTrayCompose = useCallback(
    (to?: string[], subject?: string, body?: string) => {
      deps.setScreen("mail");
      deps.openNewCompose(to);
      if (subject || body) {
        deps.updateComposeDraft({
          ...(subject ? { subject } : {}),
          ...(body ? { body } : {}),
        });
      }
    },
    [deps],
  );

  const onOpenExternalFile = useCallback(
    (fileName: string) => {
      deps.setScreen("mail");
      deps.pushToast({
        tone: "info",
        title: t("toasts.externalFileReceived", { name: fileName }),
        detail: t("toasts.externalFileReadonlyDetail"),
      });
    },
    [deps],
  );

  useDesktopBootstrap({
    ...deps,
    setStorage: storageOps.setStorage,
    onTrayCompose,
    onOpenExternalFile,
  });

  const syncLabelForAccounts = useCallback(
    (next: EmailAccount[], activeNow: boolean, lang: LanguageCode) => {
      if (activeNow) {
        if (!isSyncLabelActive(runtimeRef.current.syncLabel)) {
          const nextLabel = t("topbar.syncingEllipsis");
          runtimeRef.current.syncLabel = nextLabel;
          deps.setSyncLabel(nextLabel);
        }
        return;
      }
      if (
        next.length > 0 &&
        deriveAccountSyncState(next).syncingAccounts.length === 0 &&
        !runtimeRef.current.manualSyncPending
      ) {
        const idle = resolveIdleSyncLabel(next, lang);
        runtimeRef.current.syncLabel = idle;
        deps.setSyncLabel(idle);
      }
    },
    [deps],
  );

  const eventHandlers = useMemo(
    () => ({
      onTrayCompose,
      onTraySyncAll: deps.onTraySyncAll,
      onOpenExternalFile,
      onProfileSwitched: () => {
        setSyncProgressByAccount(new Map());
        deps.onResetStoresForSwitch();
        void deps.refreshProfilesAndAccounts();
      },
      onAccountStatus: (p: {
        accountId: string;
        status: string;
        lastError?: string;
      }) => {
        const lang = getCurrentLanguage();
        const st = normalizeAccountRuntimeStatus(p.status);
        const next = applyAccountStatusToList(
          runtimeRef.current.accounts,
          p,
          lang,
        );
        runtimeRef.current.accounts = next;
        deps.updateAccount(p.accountId, buildAccountStatusPatch(p, lang));
        syncLabelForAccounts(next, st === "syncing", lang);
      },
      onSyncProgress: (p: LiveSyncProgress) => {
        const lang = getCurrentLanguage();
        setSyncProgressByAccount((prev) => new Map(prev).set(p.accountId, p));
        const cur = runtimeRef.current.accounts;
        const prevAcc = cur.find((a) => a.id === p.accountId);
        const next = applySyncProgressToAccounts(cur, p, lang);
        runtimeRef.current.accounts = next;
        const updatedAcc = next.find((a) => a.id === p.accountId);
        if (updatedAcc && updatedAcc !== prevAcc)
          deps.updateAccount(p.accountId, updatedAcc);
        syncLabelForAccounts(next, p.status === "syncing", lang);
        if (p.status !== "syncing" && prevAcc?.status === "syncing")
          void deps.refreshProfilesAndAccounts().catch(() => undefined);
      },
      onMailDelta: deps.onMailDelta,
      onOutboxUpdated: (p: { state: string; lastError?: string }) => {
        deps.onMailDelta();
        if (p.state === "sent")
          deps.pushToast({ tone: "success", title: t("toasts.mailDelivered") });
        else if (p.state === "failed")
          deps.pushToast({
            tone: "danger",
            title: t("toasts.mailSendFailedOutbox"),
            detail: p.lastError,
          });
      },
      onTrayUnlockProfile: (profileId: string) =>
        deps.setOverlay({
          type: "profile-manage",
          mode: "unlock",
          targetProfileId: profileId,
        }),
    }),
    [deps, onOpenExternalFile, onTrayCompose, syncLabelForAccounts],
  );
  useDesktopRuntimeEvents(eventHandlers);

  return { ...storageOps, syncProgressByAccount };
}
