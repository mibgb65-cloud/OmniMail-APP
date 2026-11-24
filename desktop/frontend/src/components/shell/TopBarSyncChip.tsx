import { useEffect, useRef, useState } from "react";
import {
  isSyncLabelActive,
  isSyncLabelBlocked,
  isSyncLabelHealthy,
  useI18n,
} from "../../i18n";
import { useApp } from "../../state/AppContext";
import { AsyncStateGlyph } from "../common/AsyncStateGlyph";
import { Tooltip } from "../common/Tooltip";

export function TopBarSyncChip() {
  const { viewport, workspace, triggerSyncAll } = useApp();
  const { t, localizeText } = useI18n();
  const { bannerMode, syncLabel } = workspace;

  const hasNoAccount = workspace.accounts.length === 0;
  const isOffline = bannerMode === "offline";
  const isAuthExpired = bannerMode === "auth-expired";
  const isCompact = viewport === "compact";
  const isLaptop = viewport === "laptop";
  const isSyncing = !hasNoAccount && isSyncLabelActive(syncLabel);

  const wasSyncingRef = useRef(false);
  const [showJustDone, setShowJustDone] = useState(false);

  useEffect(() => {
    if (isSyncing) {
      wasSyncingRef.current = true;
      const clearNow = window.setTimeout(() => setShowJustDone(false), 0);
      return () => window.clearTimeout(clearNow);
    }
    if (wasSyncingRef.current) {
      wasSyncingRef.current = false;
      if (isSyncLabelHealthy(syncLabel)) {
        const enterTimer = window.setTimeout(() => setShowJustDone(true), 0);
        const holdTimer = window.setTimeout(() => setShowJustDone(false), 1050);
        return () => {
          window.clearTimeout(enterTimer);
          window.clearTimeout(holdTimer);
        };
      }
    }
    return undefined;
  }, [isSyncing, syncLabel]);

  const syncPhase = isSyncing ? "syncing" : showJustDone ? "done" : "idle";

  const text = hasNoAccount
    ? t("topbar.noAccount")
    : syncPhase === "syncing"
      ? isCompact
        ? t("topbar.syncingShort")
        : localizeText(syncLabel)
      : syncPhase === "done"
        ? isCompact
          ? t("topbar.syncedShort")
          : t("topbar.allSyncedDone")
        : isOffline
          ? isCompact
            ? t("topbar.offlineShort")
            : t("topbar.offlineCached")
          : isAuthExpired
            ? isCompact
              ? t("topbar.reauthShort")
              : t("topbar.reauthOne")
            : isCompact
              ? isSyncLabelHealthy(syncLabel)
                ? t("topbar.syncedShort")
                : isSyncLabelBlocked(syncLabel)
                  ? t("topbar.syncPartialFailed")
                  : t("topbar.syncingCompact")
              : isLaptop && isSyncLabelHealthy(syncLabel)
                ? t("topbar.accountsSyncedCount", {
                    count: workspace.accounts.length,
                  })
                : localizeText(syncLabel);

  const dotTone = hasNoAccount
    ? "muted"
    : isAuthExpired || isSyncLabelBlocked(syncLabel)
      ? "danger"
      : isOffline
        ? "warning"
        : "";

  return (
    <Tooltip
      label={
        hasNoAccount ? t("topbar.addFirstAccountTip") : t("topbar.syncAllTip")
      }
      shortcut={hasNoAccount ? undefined : "Ctrl+R"}
    >
      <button
        type="button"
        aria-busy={syncPhase === "syncing" ? "true" : undefined}
        data-sync-phase={syncPhase}
        className="sync-status-chip"
        onClick={() =>
          hasNoAccount
            ? workspace.setOverlay({ type: "add-account" })
            : triggerSyncAll()
        }
      >
        {syncPhase === "syncing" ? (
          <AsyncStateGlyph status="loading" size={13} />
        ) : syncPhase === "done" ? (
          <AsyncStateGlyph status="success" size={13} />
        ) : (
          <span className={`status-dot ${dotTone}`} />
        )}
        <span className="truncate">{text}</span>
      </button>
    </Tooltip>
  );
}
