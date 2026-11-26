import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { formatByteSize, formatSpeedBps } from "../../utils/updateFormat";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";

export function UpdateFlowModalBody({
  latestVer,
  notesText,
}: {
  latestVer: string;
  notesText: string;
}) {
  const { updateStore } = useApp();
  const { t } = useI18n();
  const { checkResult, checking, checkError, flowState, progress } =
    updateStore;

  const isDownloading =
    flowState === "downloading" || flowState === "verifying";
  const isReady = flowState === "ready" || flowState === "installing";
  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const speed = formatSpeedBps(progress?.speedBps ?? 0);

  return (
    <div className="settings-card">
      <div className="row-between" style={{ gap: 8 }}>
        <strong>
          {checking
            ? t("overlays.updateCheckingGithubTitle")
            : checkError
              ? t("updater.toastCheckFailedTitle")
              : checkResult?.hasUpdate
                ? t("overlays.updateFoundVersionTitle", { version: latestVer })
                : t("overlays.updateCurrentLatestTitle")}
        </strong>
        <span
          className={`pill ${
            checking
              ? "pill-accent"
              : checkError || flowState === "error"
                ? "pill-danger"
                : checkResult?.hasUpdate
                  ? "pill-warning"
                  : "pill-success"
          }`}
        >
          {checking
            ? t("overlays.updateBadgeChecking")
            : checkError || flowState === "error"
              ? t("updater.chipErrorLaptop")
              : checkResult?.hasUpdate
                ? t("overlays.updateBadgeHasUpdate")
                : t("overlays.updateBadgeLatest")}
        </span>
      </div>

      {(checkError || flowState === "error") && (
        <div className="ufm-error-box">
          <Icon name="alertCircle" size={15} />
          <span>{checkError || progress?.error}</span>
        </div>
      )}

      {(isDownloading || isReady) && (
        <div className="tup-progress-box" data-state={flowState}>
          <div className="tup-progress-top">
            <span>
              {flowState === "verifying"
                ? t("updater.popVerifyingStage")
                : isReady
                  ? t("updater.popReadyStage")
                  : t("updater.popDownloadingStage", { percent: pct })}
            </span>
            <span className="tup-speed">
              {speed || formatByteSize(progress?.totalBytes ?? 0)}
            </span>
          </div>
          <div className="tup-progress-track">
            <div
              className="tup-progress-fill"
              style={{ width: `${isReady ? 100 : pct}%` }}
            />
          </div>
          {isReady && progress?.sha256 && (
            <div className="ufm-sha-line">
              {t("updater.modalShaVerifiedLabel", {
                hash: `${progress.sha256.slice(0, 16)}…${progress.sha256.slice(-8)}`,
              })}
            </div>
          )}
        </div>
      )}

      <div className="tup-section-label">
        {t("updater.modalFullNotesTitle")}
      </div>
      <FadeScroll className="ufm-notes-scroll">
        <div className="ufm-notes-body">
          {checking ? t("overlays.updateCheckingDesc") : notesText}
        </div>
      </FadeScroll>
    </div>
  );
}
