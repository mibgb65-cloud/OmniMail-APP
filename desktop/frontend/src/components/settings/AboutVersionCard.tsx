import { formatUnixTimestamp, useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { formatSpeedBps, formatVersionTag } from "../../utils/updateFormat";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";

export function AboutVersionCard() {
  const { workspace, updateStore } = useApp();
  const { lang, t, formatTime } = useI18n();
  const { buildInfo, prefs, checkResult, checking, flowState, progress } =
    updateStore;

  const curVer = formatVersionTag(buildInfo.version);
  const latestVer = formatVersionTag(
    progress?.version || checkResult?.latestVersion || buildInfo.version,
  );
  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const speed = formatSpeedBps(progress?.speedBps ?? 0);
  const speedPart = speed
    ? t("updater.chipDownloadingSpeedPart", { speed })
    : "";

  const builtAt =
    buildInfo.buildTime && buildInfo.buildTime !== "dev"
      ? t("settings.aboutBuiltAtPart", {
          time: formatTime(buildInfo.buildTime),
        })
      : "";
  const lastCheckLine =
    prefs.lastUpdateCheckAt > 0
      ? t("updater.aboutLastCheckedLabel", {
          time: formatUnixTimestamp(prefs.lastUpdateCheckAt, lang),
        })
      : t("updater.aboutNeverCheckedLabel");

  const hasAvail = Boolean(checkResult?.hasUpdate);
  const isDownloading =
    flowState === "downloading" || flowState === "verifying";
  const isReady = flowState === "ready" || flowState === "installing";
  const isError = flowState === "error";
  const showSubBanner = hasAvail || isDownloading || isReady || isError;

  const statusPillClass = isReady
    ? "pill pill-success"
    : isDownloading || hasAvail
      ? "pill pill-accent"
      : "pill pill-neutral";
  const statusPillLabel = isReady
    ? t("updater.aboutStatusReady")
    : isDownloading
      ? t("updater.aboutStatusDownloading", { percent: pct })
      : hasAvail
        ? t("updater.aboutStatusHasUpdate", { version: latestVer })
        : t("updater.aboutStatusLatest");

  return (
    <div className="settings-card about-hero-card">
      <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <BrandLogo size={42} />
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="about-product-title">OmniMail Desktop</span>
              <span
                className={`pill ${buildInfo.isBeta ? "pill-warning" : "pill-accent"}`}
              >
                {buildInfo.isBeta
                  ? t("settings.aboutBetaBadge")
                  : t("settings.aboutStableBadge")}
              </span>
              <span className={statusPillClass}>{statusPillLabel}</span>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 3 }}>
              {t("settings.aboutVersionRow", {
                version: curVer,
                builtAt,
              })}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              {lastCheckLine}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={checking}
          onClick={() =>
            void updateStore.runCheck({ manual: true, toastOnLatest: true })
          }
        >
          <Icon name="refresh" size={14} />
          <span>
            {checking
              ? t("updater.aboutCheckingBtn")
              : t("updater.aboutCheckNowBtn")}
          </span>
        </button>
      </div>

      {showSubBanner && (
        <div
          className="about-update-subbanner"
          data-tone={isReady ? "ready" : isError ? "error" : "accent"}
        >
          <div className="about-update-subbanner-text">
            <Icon
              name={
                isReady ? "checkCircle" : isError ? "alertCircle" : "sparkle"
              }
              size={15}
            />
            <span>
              {isReady
                ? t("updater.aboutCardBannerReady", { version: latestVer })
                : flowState === "verifying"
                  ? t("updater.aboutCardBannerVerifying")
                  : isDownloading
                    ? t("updater.aboutCardBannerDownloading", {
                        version: latestVer,
                        percent: pct,
                        speedPart,
                      })
                    : isError
                      ? t("updater.aboutCardBannerError", {
                          error:
                            progress?.error ||
                            updateStore.checkError ||
                            t("updater.chipErrorWide"),
                        })
                      : t("updater.aboutCardBannerAvailable", {
                          version: latestVer,
                        })}
            </span>
          </div>

          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                workspace.setOverlay({
                  type: "update-flow",
                  stage: "available",
                })
              }
            >
              {t("updater.aboutViewChangelogBtn")}
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
                {t("updater.popSilentRestartBtn")}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void updateStore.startSilentUpdate(true)}
              >
                {t("updater.popSilentUpdateBtn")}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="settings-row">
        <span className="text-xs text-muted">{t("settings.aboutSummary")}</span>
      </div>
    </div>
  );
}
