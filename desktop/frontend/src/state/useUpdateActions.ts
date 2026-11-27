import { useCallback } from "react";
import { t as translateNow } from "../i18n";
import { parseBackendError, updaterApi } from "../services/backendClient";
import type { ToastNotice } from "../types/ui";
import { formatVersionTag } from "../utils/updateFormat";
import { openSafeExternalUrl } from "./desktopActions";
import type { useUpdateStore } from "./useUpdateStore";

type RawUpdateStore = ReturnType<typeof useUpdateStore>;

export function useUpdateActions(
  core: RawUpdateStore,
  pushToast: (notice: Omit<ToastNotice, "id">, durationMs?: number) => string,
) {
  const {
    prefs,
    setPrefs,
    checkResult,
    setCheckResult,
    flowState,
    setFlowState,
    progress,
    runCheck,
    installByPath,
    clearAutoRestart,
  } = core;

  const setAutoCheck = useCallback(
    async (enabled: boolean) => {
      const next = { ...prefs, autoCheckUpdates: enabled };
      setPrefs(next);
      try {
        const saved = await updaterApi.updatePreferences(next);
        setPrefs(saved);
      } catch (err) {
        pushToast({ tone: "danger", title: parseBackendError(err).message });
      }
    },
    [prefs, pushToast, setPrefs],
  );

  const setChannel = useCallback(
    async (channel: "stable" | "beta") => {
      const next = { ...prefs, updateChannel: channel };
      setPrefs(next);
      try {
        const saved = await updaterApi.updatePreferences(next);
        setPrefs(saved);
        void runCheck({ manual: false, channel });
      } catch (err) {
        pushToast({ tone: "danger", title: parseBackendError(err).message });
      }
    },
    [prefs, pushToast, runCheck, setPrefs],
  );

  const skipVersion = useCallback(
    async (version?: string) => {
      const target = formatVersionTag(version || checkResult?.latestVersion);
      if (!target) return;
      await updaterApi.skipVersion(target).catch(() => undefined);
      setPrefs((p) => ({ ...p, skippedVersion: target }));
      setCheckResult((prev) => (prev ? { ...prev, skipped: true } : prev));
      if (flowState === "available" || flowState === "error") {
        setFlowState("idle");
      }
      pushToast({
        tone: "info",
        title: translateNow("updater.toastSkippedTitle", { version: target }),
      });
    },
    [
      checkResult?.latestVersion,
      flowState,
      pushToast,
      setCheckResult,
      setFlowState,
      setPrefs,
    ],
  );

  const startSilentUpdate = useCallback(
    async (autoInstall = true) => {
      clearAutoRestart();
      if (!checkResult?.hasUpdate) return;
      if (!checkResult.assetUrl || !checkResult.sumsUrl) {
        if (checkResult.releaseUrl) {
          await openSafeExternalUrl(checkResult.releaseUrl);
        }
        return;
      }
      setFlowState("downloading");
      try {
        const fallbackVer = formatVersionTag(checkResult.latestVersion)
          .replace(/-beta\./i, ".beta.")
          .replace(/-alpha\./i, ".alpha.");
        await updaterApi.downloadUpdate({
          version: checkResult.latestVersion,
          assetName:
            checkResult.assetName ||
            `OmniMail-windows-Setup-${fallbackVer}.exe`,
          assetUrl: checkResult.assetUrl,
          assetSize: checkResult.assetSize || 0,
          sumsUrl: checkResult.sumsUrl,
          autoInstall,
        });
      } catch (err) {
        setFlowState("error");
        pushToast({
          tone: "danger",
          title: parseBackendError(err).message,
        });
      }
    },
    [checkResult, clearAutoRestart, pushToast, setFlowState],
  );

  const cancelDownload = useCallback(async () => {
    clearAutoRestart();
    await updaterApi.cancelDownload().catch(() => undefined);
    setFlowState(checkResult?.hasUpdate ? "available" : "idle");
  }, [checkResult?.hasUpdate, clearAutoRestart, setFlowState]);

  const installReadyUpdate = useCallback(
    async (silent = true) => {
      const targetPath = progress?.filePath ?? "";
      if (!targetPath) return;
      await installByPath(targetPath, silent);
    },
    [installByPath, progress?.filePath],
  );

  const openDownloadFolder = useCallback(async () => {
    await updaterApi
      .openDownloadDir(progress?.filePath ?? "")
      .catch(() => undefined);
  }, [progress?.filePath]);

  const hasUnskippedUpdate = Boolean(
    checkResult?.hasUpdate && !checkResult.skipped,
  );
  const chipVisible =
    flowState === "downloading" ||
    flowState === "verifying" ||
    flowState === "ready" ||
    flowState === "installing" ||
    flowState === "error" ||
    hasUnskippedUpdate;

  return {
    ...core,
    hasUnskippedUpdate,
    chipVisible,
    setAutoCheck,
    setChannel,
    skipVersion,
    startSilentUpdate,
    cancelDownload,
    installReadyUpdate,
    openDownloadFolder,
  };
}

export type UpdateStoreValue = ReturnType<typeof useUpdateActions>;
