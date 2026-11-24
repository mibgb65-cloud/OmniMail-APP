import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  formatBytes,
  type MigrationResult,
  type TargetDirCheck,
} from "../../state/storageHelpers";
import {
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { DataDirMigrateFooter } from "./DataDirMigrateFooter";

export function DataDirMigrateModal() {
  const { workspace, desktopBridge, toastStore } = useApp();
  const { lang, t } = useI18n();
  const { storage } = desktopBridge;

  const [targetPath, setTargetPath] = useState("D:\\OmniMailData");
  const [keepSource, setKeepSource] = useState(true);
  const [check, setCheck] = useState<TargetDirCheck | null>(null);
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [doneResult, setDoneResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!targetPath.trim()) {
        setCheck(null);
        return;
      }
      void desktopBridge.inspectDirectory(targetPath).then((res) => {
        if (active) setCheck(res);
      });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [desktopBridge, targetPath, lang]);

  const handleBrowse = async () => {
    const picked = await desktopBridge.pickDirectory();
    if (picked) {
      setTargetPath(picked);
      if (status === "error") setStatus("idle");
    }
  };

  const handleMigrate = async () => {
    if (!check?.valid || check.sameAsCurrent) return;
    setStatus("loading");
    try {
      const res = await desktopBridge.migrateDirectory(targetPath, keepSource);
      setStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.migratedDataDirTitle"),
        detail: t("toasts.migratedDataDirDetail", { dir: res.newDataDir }),
      });
      await waitSuccessHold(900);
      setDoneResult(res);
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.migrateDataDirFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  const busyOrDone =
    Boolean(doneResult) || status === "loading" || status === "success";
  const checkValid = Boolean(check?.valid && !check.sameAsCurrent);
  const backToStorage = () =>
    workspace.setOverlay({ type: "settings", tab: "storage" });
  const spaceRow =
    check && check.freeBytes > 0
      ? t("overlays.migrateSpaceCheckRow", {
          free: formatBytes(check.freeBytes),
          required: formatBytes(check.requiredBytes),
        })
      : "";
  const copiedSummary = doneResult
    ? t("overlays.migrateCopiedSummary", {
        files: doneResult.copiedFiles,
        bytes: formatBytes(doneResult.copiedBytes),
        dir: doneResult.newDataDir,
      })
    : "";
  const bootstrapHint = t("overlays.migrateBootstrapUpdatedHint", {
    path: storage.bootstrapPath,
  });

  return (
    <ModalShell
      heading={t("overlays.migrateHeading")}
      subtitle={t("overlays.migrateSubtitle")}
      maxWidth={580}
      onClose={backToStorage}
      footer={
        <DataDirMigrateFooter
          done={Boolean(doneResult)}
          status={status}
          busyOrDone={busyOrDone}
          checkValid={checkValid}
          onBack={backToStorage}
          onRestart={() => void desktopBridge.restartApp()}
          onMigrate={() => void handleMigrate()}
        />
      }
    >
      <div className="settings-card">
        <div className="text-xs text-muted">
          {t("overlays.migrateCurrentDirUsed", {
            used: formatBytes(storage.usedBytes),
          })}
        </div>
        <div className="storage-path-box selectable truncate">
          {storage.dataDir}
        </div>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          {t("overlays.migrateChooseNewLabel")}
        </label>
        <div className="row">
          <input
            type="text"
            className="input"
            style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
            value={targetPath}
            disabled={busyOrDone}
            onChange={(e) => {
              setTargetPath(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder={t("overlays.migratePathPlaceholder")}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busyOrDone}
            onClick={() => void handleBrowse()}
          >
            <Icon name="folder" size={14} /> {t("overlays.migrateBrowseBtn")}
          </button>
        </div>

        {check && !doneResult && (
          <div
            className="migrate-status-box"
            data-tone={checkValid ? "ok" : "warn"}
          >
            <div className="row" style={{ gap: 6, fontWeight: 600 }}>
              <Icon
                name={checkValid ? "checkCircle" : "alertCircle"}
                size={14}
              />
              <span>{check.message}</span>
            </div>
            {spaceRow && <div>{spaceRow}</div>}
          </div>
        )}
        {doneResult ? (
          <div className="migrate-status-box" data-tone="ok">
            <strong>{copiedSummary}</strong>
            <div>{bootstrapHint}</div>
          </div>
        ) : (
          <Checkbox
            checked={keepSource}
            onChange={setKeepSource}
            ariaLabel={t("overlays.migrateKeepSourceAria")}
          >
            {t("overlays.migrateKeepSourceLabel")}
          </Checkbox>
        )}
      </div>
    </ModalShell>
  );
}
