import { t as translateNow } from "../i18n";
import type { UpdaterProgressEvent } from "../services/backendClient";
import type { ToastNotice } from "../types/ui";
import { formatVersionTag, type UpdateFlowState } from "../utils/updateFormat";

export function dispatchReadyAutoInstall({
  ev,
  latestVersion,
  draftOpen,
  clearAutoRestart,
  scheduleRestart,
  pushToast,
}: {
  ev: UpdaterProgressEvent;
  latestVersion?: string;
  draftOpen: boolean;
  clearAutoRestart: () => void;
  scheduleRestart: (filePath: string) => void;
  pushToast: (notice: Omit<ToastNotice, "id">, durationMs?: number) => string;
}) {
  if (!ev.autoInstall || !ev.filePath) return;
  const ver = formatVersionTag(ev.version || latestVersion);
  if (draftOpen) {
    pushToast(
      {
        tone: "info",
        title: translateNow("updater.toastReadyDraftSafeTitle", {
          version: ver,
        }),
        detail: translateNow("updater.toastReadyDraftSafeDetail"),
      },
      6000,
    );
    return;
  }

  clearAutoRestart();
  scheduleRestart(ev.filePath);
  pushToast(
    {
      tone: "success",
      title: translateNow("updater.toastReadyAutoRestartTitle", {
        version: ver,
      }),
      actionLabel: translateNow("updater.toastReadyAutoRestartAction"),
      onAction: clearAutoRestart,
    },
    3200,
  );
}

export function mapProgressToFlowState(
  stage: UpdaterProgressEvent["stage"],
  hasUpdate: boolean,
): UpdateFlowState {
  if (stage === "downloading") return "downloading";
  if (stage === "verifying") return "verifying";
  if (stage === "installing") return "installing";
  if (stage === "ready") return "ready";
  if (stage === "error") return "error";
  return hasUpdate ? "available" : "idle";
}
