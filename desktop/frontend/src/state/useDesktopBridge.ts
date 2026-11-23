import { useCallback, useEffect, useMemo, useState } from "react";
import { GetBootstrapState } from "../../bindings/omnimail/desktopservice";
import type { EmailAccount } from "../types/account";
import type {
  AppSettings,
  LanguageCode,
  ThemePreference,
} from "../types/settings";
import type {
  OverlayModal,
  RuntimeBannerMode,
  WorkspaceScreen,
} from "../types/ui";
import { useDesktopRuntimeEvents } from "./desktopActions";
import {
  parseMailtoUrl,
  resolveThemeFromPref,
  setDesktopBridgeReady,
} from "./storageHelpers";
import type { LiveSyncProgress } from "./syncProgress";
import { useDesktopStorageOps } from "./useDesktopStorageOps";

interface BridgeDeps {
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
  }>;
  onResetStoresForSwitch: () => void;
  onMailDelta: (addedIds?: readonly string[]) => void;
  openNewCompose: (to?: string[]) => void;
  updateComposeDraft: (patch: { subject?: string; body?: string }) => void;
  pushToast: (notice: {
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
  const { setStorage } = storageOps;
  const [syncProgressByAccount, setSyncProgressByAccount] = useState(
    () => new Map<string, LiveSyncProgress>(),
  );

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
        title: `已接收关联文件：${fileName}`,
        detail: "已载入本地安全只读视图",
      });
    },
    [deps],
  );

  useEffect(() => {
    let active = true;
    void GetBootstrapState()
      .then(async (dto) => {
        setDesktopBridgeReady(true);
        if (!active) return;
        setStorage(dto.storage);
        const pref = (
          ["light", "dark", "system"].includes(dto.preferences.themePreference)
            ? dto.preferences.themePreference
            : "system"
        ) as ThemePreference;
        const lang: LanguageCode =
          dto.preferences.language === "en-US" ? "en-US" : "zh-CN";
        deps.applySettingsFromBackend({
          themePreference: pref,
          theme: resolveThemeFromPref(pref),
          language: lang,
          closeToTray: dto.preferences.closeToTray,
          launchAtStartup: dto.preferences.launchAtStartup,
          silentStartToTray: Boolean(dto.preferences.silentStartToTray),
        });
        const prof = await deps.refreshProfilesAndAccounts();
        if (!dto.bootstrap.initialized) deps.setScreen("onboarding");
        else if (
          !prof.requiresUnlock &&
          prof.launchBehavior === "ask-on-launch"
        )
          deps.setOverlay({ type: "profile-manage", mode: "switch" });
        if (dto.launchIntent.mailtoUrl) {
          const p = parseMailtoUrl(dto.launchIntent.mailtoUrl);
          onTrayCompose(p.to, p.subject, p.body);
        }
        if (dto.launchIntent.filePath)
          onOpenExternalFile(dto.launchIntent.filePath);
      })
      .catch(() => void deps.refreshProfilesAndAccounts());
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      onAccountStatus: (p: { accountId: string; status: string }) => {
        const st =
          p.status === "syncing" ||
          p.status === "auth-expired" ||
          p.status === "error"
            ? p.status
            : "connected";
        deps.updateAccount(p.accountId, { status: st, lastSyncedAt: "刚刚" });
        if (st === "auth-expired") deps.setBannerMode("auth-expired");
        else if (st === "error") deps.setBannerMode("partial-sync");
        else if (st === "connected") deps.setSyncLabel("所有邮箱已同步");
      },
      onSyncProgress: (p: LiveSyncProgress) => {
        setSyncProgressByAccount((prev) => new Map(prev).set(p.accountId, p));
        if (p.status === "syncing") deps.setSyncLabel("正在同步…");
        else deps.setSyncLabel(p.stage);
      },
      onMailDelta: deps.onMailDelta,
      onOutboxUpdated: (p: { state: string; lastError?: string }) => {
        deps.onMailDelta();
        if (p.state === "sent") {
          deps.pushToast({ tone: "success", title: "邮件已成功送达" });
        } else if (p.state === "failed") {
          deps.pushToast({
            tone: "danger",
            title: "邮件发送失败，已移入待发送队列",
            detail: p.lastError,
          });
        }
      },
      onTrayUnlockProfile: (profileId: string) => {
        deps.setOverlay({
          type: "profile-manage",
          mode: "unlock",
          targetProfileId: profileId,
        });
      },
    }),
    [deps, onOpenExternalFile, onTrayCompose],
  );
  useDesktopRuntimeEvents(eventHandlers);

  return { ...storageOps, syncProgressByAccount };
}
