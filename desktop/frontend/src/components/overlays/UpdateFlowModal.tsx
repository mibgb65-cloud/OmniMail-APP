import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import type { UpdateStage } from "../../types/ui";
import { formatVersionTag } from "../../utils/updateFormat";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { UpdateFlowModalBody } from "./UpdateFlowModalBody";

export function UpdateFlowModal({
  stage: initialStage,
}: {
  stage: UpdateStage;
}) {
  const { workspace, updateStore } = useApp();
  const { isEn, t, formatTime } = useI18n();
  const { buildInfo, checkResult, checking, flowState, progress } = updateStore;
  const [btnStatus, setBtnStatus] = useState<AsyncActionStatus>("idle");

  const triggerManualCheck = useCallback(async () => {
    setBtnStatus("loading");
    const res = await updateStore.runCheck({ manual: true });
    setBtnStatus(res ? "success" : "error");
  }, [updateStore]);

  useEffect(() => {
    if (initialStage === "checking" || !checkResult) {
      const timer = window.setTimeout(() => {
        void triggerManualCheck();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [checkResult, initialStage, triggerManualCheck]);

  const curVer = formatVersionTag(
    checkResult?.currentVersion || buildInfo.version,
  );
  const latestVer = formatVersionTag(
    progress?.version || checkResult?.latestVersion || curVer,
  );
  const checkedSuffix = checkResult?.checkedAt
    ? ` · ${formatTime(checkResult.checkedAt)}`
    : "";
  const rawNotes = checkResult?.releaseNotes ?? "";
  const notesText = !rawNotes
    ? t("overlays.updateNoNotesFallback")
    : isEn && rawNotes.startsWith("当前运行的是 OmniMail 开源")
      ? t("overlays.updatePreviewNotes")
      : rawNotes;

  const isDownloading =
    flowState === "downloading" || flowState === "verifying";
  const isReady = flowState === "ready" || flowState === "installing";
  const releaseUrl =
    checkResult?.releaseUrl ||
    "https://github.com/omnimail-org/omnimail/releases";

  return (
    <ModalShell
      heading={t("overlays.updateHeading")}
      subtitle={`${t("overlays.updateSubtitle", {
        version: curVer,
        beta:
          (checkResult?.channel || buildInfo.channel) === "beta"
            ? " (Beta)"
            : "",
      })}${checkedSuffix}`}
      maxWidth={600}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 8 }}>
            <AsyncActionButton
              size="sm"
              variant="secondary"
              status={checking ? "loading" : btnStatus}
              idleIcon="refresh"
              idleLabel={t("overlays.updateRecheckIdle")}
              loadingLabel={t("overlays.updateRecheckLoading")}
              successLabel={
                checkResult?.hasUpdate
                  ? t("overlays.updateHasNewBtn")
                  : t("overlays.updateUpToDateBtn")
              }
              errorLabel={t("updater.modalErrorRetryBtn")}
              successHoldMs={1000}
              onSuccessHoldEnd={() => setBtnStatus("idle")}
              onClick={() => void triggerManualCheck()}
            />
            {isReady && progress?.filePath && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void updateStore.openDownloadFolder()}
              >
                <Icon name="folder" size={14} />
                <span>{t("updater.modalOpenDownloadDirBtn")}</span>
              </button>
            )}
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void openSafeExternalUrl(releaseUrl)}
            >
              <Icon name="external" size={14} />
              <span>{t("overlays.updateOpenGithubBtn")}</span>
            </button>
            {isDownloading ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void updateStore.cancelDownload()}
              >
                {t("updater.popCancelDownloadBtn")}
              </button>
            ) : isReady ? (
              <button
                type="button"
                className="btn btn-primary btn-sm tup-btn-ready"
                disabled={flowState === "installing"}
                onClick={() => void updateStore.installReadyUpdate(true)}
              >
                <Icon name="checkCircle" size={14} />
                <span>{t("updater.popSilentRestartBtn")}</span>
              </button>
            ) : checkResult?.hasUpdate ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void updateStore.startSilentUpdate(true)}
              >
                <Icon name="zap" size={14} />
                <span>{t("updater.popSilentUpdateBtn")}</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => workspace.setOverlay({ type: "none" })}
              >
                {t("common.close")}
              </button>
            )}
          </div>
        </>
      }
    >
      <UpdateFlowModalBody latestVer={latestVer} notesText={notesText} />
    </ModalShell>
  );
}
