import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { formatSpeedBps } from "../../utils/updateFormat";
import { Icon } from "../common/Icon";

export function TopBarUpdatePopoverActions({
  latestVer,
  onClose,
}: {
  latestVer: string;
  onClose: () => void;
}) {
  const { workspace, composeStore, updateStore } = useApp();
  const { t } = useI18n();
  const { flowState, progress } = updateStore;

  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const speed = formatSpeedBps(progress?.speedBps ?? 0);
  const isDownloading =
    flowState === "downloading" || flowState === "verifying";
  const isReady = flowState === "ready";
  const isInstalling = flowState === "installing";
  const isError = flowState === "error";

  return (
    <>
      {isDownloading || isReady || isInstalling || isError ? (
        <div className="tup-progress-box" data-state={flowState}>
          <div className="tup-progress-top">
            <span className="truncate">
              {flowState === "verifying"
                ? t("updater.popVerifyingStage")
                : isReady
                  ? t("updater.popReadyStage")
                  : isInstalling
                    ? t("updater.popInstallingStage")
                    : isError
                      ? progress?.error || t("updater.chipErrorWide")
                      : t("updater.popDownloadingStage", { percent: pct })}
            </span>
            {speed && flowState === "downloading" && (
              <span className="tup-speed">{speed}</span>
            )}
          </div>
          {(isDownloading || isReady || isInstalling) && (
            <div className="tup-progress-track">
              <div
                className="tup-progress-fill"
                style={{ width: `${isReady || isInstalling ? 100 : pct}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="tup-silent-tip">
          <Icon name="shield" size={14} />
          <span>
            {composeStore.draft
              ? t("updater.popComposeHoldHint")
              : t("updater.popSilentHint")}
          </span>
        </div>
      )}

      <div className="tup-footer">
        <div className="tup-footer-left">
          {!isDownloading && !isReady && !isInstalling && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onClose();
                void updateStore.skipVersion(latestVer);
              }}
            >
              {t("updater.popSkipBtn")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onClose();
              workspace.setOverlay({ type: "update-flow", stage: "available" });
            }}
          >
            {t("updater.popFullNotesBtn")}
          </button>
        </div>

        <div className="tup-footer-right">
          {isDownloading ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void updateStore.cancelDownload()}
            >
              {t("updater.popCancelDownloadBtn")}
            </button>
          ) : isReady || isInstalling ? (
            <button
              type="button"
              className="btn btn-primary btn-sm tup-btn-ready"
              disabled={isInstalling}
              onClick={() => {
                onClose();
                void updateStore.installReadyUpdate(true);
              }}
            >
              <Icon name="checkCircle" size={14} />
              <span>{t("updater.popSilentRestartBtn")}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onClose();
                void updateStore.startSilentUpdate(true);
              }}
            >
              <Icon name="zap" size={14} />
              <span>
                {isError
                  ? t("updater.popRetryDownloadBtn")
                  : t("updater.popSilentUpdateBtn")}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
