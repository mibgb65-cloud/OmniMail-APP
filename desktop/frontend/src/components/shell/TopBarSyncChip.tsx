import { useEffect, useRef, useState } from "react";
import { isSyncLabelActive, isSyncLabelHealthy, useI18n } from "../../i18n";
import { deriveAccountSyncState } from "../../state/accountSyncState";
import { useApp } from "../../state/AppContext";
import { buildSyncChipModel } from "../../state/syncChipModel";
import { AsyncStateGlyph } from "../common/AsyncStateGlyph";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { SyncStatusPopover } from "./SyncStatusPopover";

export function TopBarSyncChip() {
  const { viewport, workspace, triggerSyncAll } = useApp();
  const { lang, t } = useI18n();
  const { bannerMode, syncLabel, accounts } = workspace;

  const chipRef = useRef<HTMLButtonElement | null>(null);
  const wasSyncingRef = useRef(false);
  const [showJustDone, setShowJustDone] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const hasNoAccount = accounts.length === 0;
  const derived = deriveAccountSyncState(accounts);
  const isSyncing =
    !hasNoAccount &&
    (isSyncLabelActive(syncLabel) || derived.syncingAccounts.length > 0);

  useEffect(() => {
    if (isSyncing) {
      wasSyncingRef.current = true;
      const clearNow = window.setTimeout(() => setShowJustDone(false), 0);
      return () => window.clearTimeout(clearNow);
    }
    if (wasSyncingRef.current) {
      wasSyncingRef.current = false;
      if (isSyncLabelHealthy(syncLabel) && !derived.hasIssues) {
        const enterTimer = window.setTimeout(() => setShowJustDone(true), 0);
        const holdTimer = window.setTimeout(() => setShowJustDone(false), 1050);
        return () => {
          window.clearTimeout(enterTimer);
          window.clearTimeout(holdTimer);
        };
      }
    }
    return undefined;
  }, [isSyncing, syncLabel, derived.hasIssues]);

  const chipModel = buildSyncChipModel({
    accounts,
    bannerMode,
    syncLabel,
    viewport,
    showJustDone,
    lang,
  });

  const syncPhase =
    chipModel.tone === "syncing"
      ? "syncing"
      : chipModel.tone === "done"
        ? "done"
        : "idle";

  const dotClass =
    chipModel.tone === "empty"
      ? "muted"
      : chipModel.tone === "danger"
        ? "danger"
        : chipModel.tone === "warning" || chipModel.tone === "offline"
          ? "warning"
          : "";

  const tipLabel = hasNoAccount
    ? t("topbar.addFirstAccountTip")
    : chipModel.opensPopover
      ? t("topbar.chipOpenPopoverTip")
      : t("topbar.syncAllTip");

  return (
    <>
      <Tooltip
        label={tipLabel}
        shortcut={hasNoAccount || chipModel.opensPopover ? undefined : "Ctrl+R"}
      >
        <button
          ref={chipRef}
          type="button"
          aria-busy={syncPhase === "syncing" ? "true" : undefined}
          aria-expanded={chipModel.opensPopover ? popoverOpen : undefined}
          aria-haspopup={chipModel.opensPopover ? "dialog" : undefined}
          data-sync-phase={syncPhase}
          data-sync-tone={chipModel.tone}
          className="sync-status-chip"
          onClick={() => {
            if (hasNoAccount) {
              workspace.setOverlay({ type: "add-account" });
              return;
            }
            if (chipModel.opensPopover || popoverOpen) {
              setPopoverOpen((v) => !v);
              return;
            }
            triggerSyncAll();
          }}
        >
          {syncPhase === "syncing" ? (
            <AsyncStateGlyph status="loading" size={13} />
          ) : syncPhase === "done" ? (
            <AsyncStateGlyph status="success" size={13} />
          ) : (
            <span className={`status-dot ${dotClass}`} />
          )}
          <span className="truncate">{chipModel.text}</span>
          {chipModel.showChevron && (
            <span
              className={`sync-chip-chevron ${popoverOpen ? "is-open" : ""}`}
              aria-hidden="true"
            >
              <Icon name="chevronDown" size={12} />
            </span>
          )}
        </button>
      </Tooltip>

      <SyncStatusPopover
        open={popoverOpen}
        anchorRef={chipRef}
        onClose={() => setPopoverOpen(false)}
      />
    </>
  );
}
