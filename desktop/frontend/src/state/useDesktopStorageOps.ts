import { useCallback, useEffect, useState } from "react";
import {
  CompleteInitialSetup,
  GetBootstrapState,
  GetStorageInfo,
  InspectTargetDirectory,
  MigrateDataDirectory,
} from "../../bindings/omnimail/desktopservice";
import type {
  AppSettings,
  LanguageCode,
  ThemePreference,
} from "../types/settings";
import type { OverlayModal, WorkspaceScreen } from "../types/ui";
import {
  openDesktopDataDir,
  pickDesktopDataDir,
  restartDesktopApp,
} from "./desktopActions";
import {
  BROWSER_DATADIR_KEY,
  BROWSER_INIT_KEY,
  buildFallbackStorageInfo,
  inspectDirectoryInBrowser,
  isWailsDesktop,
  parseMailtoUrl,
  resolveThemeFromPref,
  setDesktopBridgeReady,
  type MigrationResult,
  type StorageInfo,
  type TargetDirCheck,
} from "./storageHelpers";

export function useDesktopStorageOps(
  settings: AppSettings,
  onAfterStorageChange: () => Promise<unknown>,
) {
  const [storage, setStorage] = useState<StorageInfo>(buildFallbackStorageInfo);

  const refreshStorage = useCallback(async () => {
    setStorage(
      isWailsDesktop() ? await GetStorageInfo() : buildFallbackStorageInfo(),
    );
  }, []);

  const inspectDirectory = useCallback(
    async (targetPath: string): Promise<TargetDirCheck> =>
      isWailsDesktop()
        ? InspectTargetDirectory(targetPath)
        : inspectDirectoryInBrowser(targetPath, storage.dataDir),
    [storage.dataDir],
  );

  const migrateDirectory = useCallback(
    async (
      targetPath: string,
      keepSource: boolean,
    ): Promise<MigrationResult> => {
      if (!isWailsDesktop()) {
        const check = inspectDirectoryInBrowser(targetPath, storage.dataDir);
        if (!check.valid || check.sameAsCurrent) throw new Error(check.message);
        try {
          window.localStorage.setItem(
            BROWSER_DATADIR_KEY,
            check.normalizedPath,
          );
        } catch {
          // 忽略受限存储异常
        }
        const prev = storage.dataDir;
        setStorage((s) => ({ ...s, dataDir: check.normalizedPath }));
        return {
          oldDataDir: prev,
          newDataDir: check.normalizedPath,
          copiedFiles: 18,
          copiedBytes: storage.usedBytes,
          keptSource: keepSource,
        };
      }
      const res = await MigrateDataDirectory(targetPath, keepSource);
      await refreshStorage();
      await onAfterStorageChange();
      return res;
    },
    [onAfterStorageChange, refreshStorage, storage.dataDir, storage.usedBytes],
  );

  const completeInitialSetup = useCallback(
    async (dataDir: string) => {
      if (!isWailsDesktop()) {
        try {
          window.localStorage.setItem(BROWSER_DATADIR_KEY, dataDir);
          window.localStorage.setItem(BROWSER_INIT_KEY, "1");
        } catch {
          // 忽略受限存储异常
        }
        setStorage((s) => ({ ...s, dataDir, initialized: true }));
        return;
      }
      const dto = await CompleteInitialSetup({
        dataDir,
        preferences: {
          themePreference: settings.themePreference,
          resolvedTheme: settings.theme,
          language: settings.language,
          closeToTray: settings.closeToTray,
          launchAtStartup: settings.launchAtStartup,
          silentStartToTray: Boolean(settings.silentStartToTray),
          autoCheckUpdates: true,
        },
      });
      setStorage(dto.storage);
      await onAfterStorageChange();
    },
    [onAfterStorageChange, settings],
  );

  return {
    storage,
    setStorage,
    refreshStorage,
    pickDirectory: pickDesktopDataDir,
    inspectDirectory,
    migrateDirectory,
    completeInitialSetup,
    openDataDir: openDesktopDataDir,
    restartApp: restartDesktopApp,
  };
}

export function useDesktopBootstrap(opts: {
  setStorage: (s: StorageInfo) => void;
  applySettingsFromBackend: (patch: Partial<AppSettings>) => void;
  refreshProfilesAndAccounts: () => Promise<{
    launchBehavior: "last-profile" | "ask-on-launch";
    requiresUnlock: boolean;
  }>;
  setScreen: (screen: WorkspaceScreen) => void;
  setOverlay: (ov: OverlayModal) => void;
  onTrayCompose: (to?: string[], subject?: string, body?: string) => void;
  onOpenExternalFile: (fileName: string) => void;
}) {
  useEffect(() => {
    let active = true;
    void GetBootstrapState()
      .then(async (dto) => {
        setDesktopBridgeReady(true);
        if (!active) return;
        opts.setStorage(dto.storage);
        const pref = (
          ["light", "dark", "system"].includes(dto.preferences.themePreference)
            ? dto.preferences.themePreference
            : "system"
        ) as ThemePreference;
        const lang: LanguageCode =
          dto.preferences.language === "en-US" ? "en-US" : "zh-CN";
        opts.applySettingsFromBackend({
          themePreference: pref,
          theme: resolveThemeFromPref(pref),
          language: lang,
          closeToTray: dto.preferences.closeToTray,
          launchAtStartup: dto.preferences.launchAtStartup,
          silentStartToTray: Boolean(dto.preferences.silentStartToTray),
        });
        const prof = await opts.refreshProfilesAndAccounts();
        if (!dto.bootstrap.initialized) opts.setScreen("onboarding");
        else if (
          !prof.requiresUnlock &&
          prof.launchBehavior === "ask-on-launch"
        )
          opts.setOverlay({ type: "profile-manage", mode: "switch" });
        if (dto.launchIntent.mailtoUrl) {
          const p = parseMailtoUrl(dto.launchIntent.mailtoUrl);
          opts.onTrayCompose(p.to, p.subject, p.body);
        }
        if (dto.launchIntent.filePath)
          opts.onOpenExternalFile(dto.launchIntent.filePath);
      })
      .catch(() => void opts.refreshProfilesAndAccounts());
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
