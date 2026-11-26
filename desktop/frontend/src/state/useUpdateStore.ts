import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppBuildInfo,
  UpdateCheckResult,
  UpdatePreferencesDTO,
} from "../../bindings/omnimail/models";
import { t as translateNow } from "../i18n";
import {
  parseBackendError,
  updaterApi,
  type UpdaterProgressEvent,
} from "../services/backendClient";
import type { ToastNotice } from "../types/ui";
import { formatVersionTag, type UpdateFlowState } from "../utils/updateFormat";
import { openSafeExternalUrl } from "./desktopActions";
import {
  dispatchReadyAutoInstall,
  mapProgressToFlowState,
} from "./updateProgressHandler";
import { useUpdateBootstrapAndEvents } from "./useUpdateScheduler";

export function useUpdateStore({
  hasActiveComposeDraft,
  pushToast,
}: {
  hasActiveComposeDraft: boolean;
  pushToast: (notice: Omit<ToastNotice, "id">, durationMs?: number) => string;
}) {
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo>(
    updaterApi.defaultBuildInfo,
  );
  const [prefs, setPrefs] = useState<UpdatePreferencesDTO>(
    updaterApi.defaultPrefs,
  );
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [flowState, setFlowState] = useState<UpdateFlowState>("idle");
  const [progress, setProgress] = useState<UpdaterProgressEvent | null>(null);

  const draftOpenRef = useRef(hasActiveComposeDraft);
  useEffect(() => {
    draftOpenRef.current = hasActiveComposeDraft;
  }, [hasActiveComposeDraft]);

  const restartTimerRef = useRef<number | null>(null);
  const clearAutoRestart = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const installByPath = useCallback(
    async (filePath: string, silent = true) => {
      clearAutoRestart();
      if (!filePath) return;
      setFlowState("installing");
      try {
        await updaterApi.installDownloaded(filePath, silent);
      } catch (err) {
        setFlowState("ready");
        pushToast({ tone: "warning", title: parseBackendError(err).message });
      }
    },
    [clearAutoRestart, pushToast],
  );

  const handleProgressEvent = useCallback(
    (ev: UpdaterProgressEvent) => {
      setProgress(ev);
      if (ev.stage === "cancelled" || ev.stage === "error") {
        clearAutoRestart();
      }
      setFlowState(
        mapProgressToFlowState(ev.stage, Boolean(checkResult?.hasUpdate)),
      );
      if (ev.stage === "ready") {
        dispatchReadyAutoInstall({
          ev,
          latestVersion: checkResult?.latestVersion,
          draftOpen: draftOpenRef.current,
          clearAutoRestart,
          scheduleRestart: (fp) => {
            restartTimerRef.current = window.setTimeout(() => {
              restartTimerRef.current = null;
              if (!draftOpenRef.current) void installByPath(fp, true);
            }, 3200);
          },
          pushToast,
        });
      }
    },
    [
      checkResult?.hasUpdate,
      checkResult?.latestVersion,
      clearAutoRestart,
      installByPath,
      pushToast,
    ],
  );

  const runCheck = useCallback(
    async (opts?: {
      manual?: boolean;
      channel?: string;
      toastOnLatest?: boolean;
    }) => {
      const manual = Boolean(opts?.manual);
      setChecking(true);
      setCheckError("");
      try {
        const res = await updaterApi.checkForUpdates(
          opts?.channel ?? "",
          manual,
        );
        setCheckResult(res);
        setPrefs((p) => ({
          ...p,
          lastUpdateCheckAt: res.checkedAtUnix || Date.now(),
        }));
        setFlowState((prev) =>
          prev === "downloading" ||
          prev === "verifying" ||
          prev === "ready" ||
          prev === "installing"
            ? prev
            : res.hasUpdate && (!res.skipped || manual)
              ? "available"
              : "idle",
        );
        if (manual && opts?.toastOnLatest && !res.hasUpdate) {
          pushToast({
            tone: "success",
            title: translateNow("updater.toastUpToDateTitle", {
              version: formatVersionTag(res.currentVersion),
            }),
          });
        }
        return res;
      } catch (err) {
        const msg = parseBackendError(err).message;
        setCheckError(msg);
        if (manual && opts?.toastOnLatest) {
          pushToast({
            tone: "danger",
            title: translateNow("updater.toastCheckFailedTitle"),
            detail: msg,
          });
        }
        return null;
      } finally {
        setChecking(false);
      }
    },
    [pushToast],
  );

  const onHydrated = useCallback(
    (info: AppBuildInfo, loadedPrefs: UpdatePreferencesDTO) => {
      setBuildInfo(info);
      setPrefs(loadedPrefs);
    },
    [],
  );
  const onScheduledCheck = useCallback(
    (channel: string) => void runCheck({ manual: false, channel }),
    [runCheck],
  );

  useUpdateBootstrapAndEvents({
    autoCheckEnabled: prefs.autoCheckUpdates,
    updateChannel: prefs.updateChannel,
    onHydrated,
    onScheduledCheck,
    onProgressEvent: handleProgressEvent,
    onUnmount: clearAutoRestart,
  });

  return {
    buildInfo,
    prefs,
    setPrefs,
    checkResult,
    setCheckResult,
    checking,
    checkError,
    flowState,
    setFlowState,
    progress,
    runCheck,
    installByPath,
    clearAutoRestart,
    openSafeExternalUrl,
  };
}
