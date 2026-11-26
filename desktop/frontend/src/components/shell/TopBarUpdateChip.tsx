import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import {
  formatSpeedBps,
  formatVersionTag,
  resolveTopBarUpdateTier,
  type TopBarUpdateTier,
} from "../../utils/updateFormat";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { TopBarUpdatePopover } from "./TopBarUpdatePopover";

export function TopBarUpdateChip() {
  const { updateStore } = useApp();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<TopBarUpdateTier>(() =>
    typeof window === "undefined"
      ? "wide"
      : resolveTopBarUpdateTier(window.innerWidth),
  );
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onResize = () => {
      const next = resolveTopBarUpdateTier(window.innerWidth);
      setTier((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!updateStore.chipVisible || tier === "ultra") {
    return null;
  }

  const { flowState, checkResult, progress } = updateStore;
  const ver = formatVersionTag(progress?.version || checkResult?.latestVersion);
  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const speed = formatSpeedBps(progress?.speedBps ?? 0);
  const speedPart = speed
    ? t("updater.chipDownloadingSpeedPart", { speed })
    : "";

  const tone =
    flowState === "ready" || flowState === "installing"
      ? "ready"
      : flowState === "error"
        ? "error"
        : "accent";

  const tooltipText =
    flowState === "ready" || flowState === "installing"
      ? t("updater.chipTooltipReady", { version: ver })
      : flowState === "verifying"
        ? t("updater.chipTooltipVerifying")
        : flowState === "downloading"
          ? t("updater.chipTooltipDownloading", { version: ver, percent: pct })
          : flowState === "error"
            ? t("updater.chipTooltipError", {
                error: progress?.error || t("updater.chipErrorWide"),
              })
            : t("updater.chipTooltipAvailable", { version: ver });

  const handleChipClick = () => {
    if (flowState === "ready" && !open) {
      void updateStore.installReadyUpdate(true);
      return;
    }
    setOpen((v) => !v);
  };

  const renderInner = () => {
    if (tier === "compact") {
      if (flowState === "downloading" || flowState === "verifying") {
        return <span className="tuc-compact-pct">{pct}%</span>;
      }
      if (flowState === "ready" || flowState === "installing") {
        return <Icon name="check" size={15} />;
      }
      if (flowState === "error") {
        return <Icon name="alertCircle" size={15} />;
      }
      return <Icon name="arrowUp" size={15} />;
    }

    if (tier === "laptop") {
      const label =
        flowState === "downloading" || flowState === "verifying"
          ? `${pct}%`
          : flowState === "ready"
            ? t("updater.chipReadyLaptop")
            : flowState === "installing"
              ? t("updater.chipInstallingLaptop")
              : flowState === "error"
                ? t("updater.chipErrorLaptop")
                : t("updater.chipLaptopHasUpdate");
      return (
        <>
          <span className="tuc-dot" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </>
      );
    }

    if (flowState === "downloading") {
      return (
        <>
          <span className="tuc-dot" aria-hidden="true" />
          <span className="truncate">
            {t("updater.chipDownloadingWide", { percent: pct, speedPart })}
          </span>
        </>
      );
    }
    if (flowState === "verifying") {
      return (
        <>
          <span className="tuc-dot" aria-hidden="true" />
          <span className="truncate">{t("updater.chipVerifyingWide")}</span>
        </>
      );
    }
    if (flowState === "ready") {
      return (
        <>
          <span className="tuc-dot" aria-hidden="true" />
          <span className="truncate">{t("updater.chipReadyWide")}</span>
        </>
      );
    }
    if (flowState === "installing") {
      return (
        <>
          <span className="tuc-dot" aria-hidden="true" />
          <span className="truncate">{t("updater.chipInstallingWide")}</span>
        </>
      );
    }
    if (flowState === "error") {
      return (
        <>
          <span className="tuc-dot" aria-hidden="true" />
          <span className="truncate">{t("updater.chipErrorWide")}</span>
        </>
      );
    }
    return (
      <>
        <span className="tuc-dot" aria-hidden="true" />
        <span className="truncate">
          {t("updater.chipNewVersion", { version: ver })}
        </span>
        <span className="tuc-mini-badge">{t("updater.chipUpdateBadge")}</span>
      </>
    );
  };

  return (
    <>
      <Tooltip label={tooltipText}>
        <button
          ref={btnRef}
          type="button"
          className={`topbar-update-chip is-${tier}`}
          data-tone={tone}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={tooltipText}
          onClick={handleChipClick}
        >
          {renderInner()}
        </button>
      </Tooltip>
      <TopBarUpdatePopover
        open={open}
        anchorRef={btnRef}
        isCompact={tier === "compact"}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
