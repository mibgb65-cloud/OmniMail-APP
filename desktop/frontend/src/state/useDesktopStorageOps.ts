import { useCallback, useState } from "react";
import {
  CompleteInitialSetup,
  GetStorageInfo,
  InspectTargetDirectory,
  MigrateDataDirectory,
} from "../../bindings/omnimail/desktopservice";
import type { AppSettings } from "../types/settings";
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
