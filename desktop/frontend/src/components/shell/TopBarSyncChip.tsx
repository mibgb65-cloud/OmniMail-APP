import { useEffect, useRef, useState } from "react";
import { useApp } from "../../state/AppContext";
import { AsyncStateGlyph } from "../common/AsyncStateGlyph";
import { Tooltip } from "../common/Tooltip";

export function TopBarSyncChip() {
  const { viewport, workspace, triggerSyncAll } = useApp();
  const { bannerMode, syncLabel } = workspace;

  const hasNoAccount = workspace.accounts.length === 0;
  const isOffline = bannerMode === "offline";
  const isAuthExpired = bannerMode === "auth-expired";
  const isCompact = viewport === "compact";
  const isLaptop = viewport === "laptop";
  const isSyncing = !hasNoAccount && syncLabel.startsWith("正在同步");

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
      if (syncLabel === "所有邮箱已同步") {
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
    ? "暂未接入邮箱"
    : syncPhase === "syncing"
      ? isCompact
        ? "同步中…"
        : syncLabel
      : syncPhase === "done"
        ? isCompact
          ? "已同步"
          : "全部已同步"
        : isOffline
          ? isCompact
            ? "离线"
            : "离线 · 本地缓存"
          : isAuthExpired
            ? isCompact
              ? "需重授权"
              : "1 个邮箱需重新授权"
            : isCompact
              ? syncLabel === "所有邮箱已同步"
                ? "已同步"
                : "同步中"
              : isLaptop && syncLabel === "所有邮箱已同步"
                ? `${workspace.accounts.length} 邮箱已同步`
                : syncLabel;

  const dotTone = hasNoAccount
    ? "muted"
    : isAuthExpired || syncLabel === "同步部分受阻"
      ? "danger"
      : isOffline
        ? "warning"
        : "";

  return (
    <Tooltip
      label={hasNoAccount ? "点击添加第一个邮箱" : "立即同步全部邮箱"}
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
