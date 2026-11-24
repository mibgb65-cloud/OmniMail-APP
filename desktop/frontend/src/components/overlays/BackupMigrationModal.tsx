import { useState } from "react";
import { useI18n } from "../../i18n";
import {
  mailApi,
  parseBackendError,
  profileApi,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Checkbox } from "../common/Checkbox";
import { ModalShell } from "../common/ModalShell";
import { PasswordInput } from "../common/PasswordInput";

export function BackupMigrationModal() {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const [includeAtts, setIncludeAtts] = useState(false);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [password, setPassword] = useState("");
  const [zipStatus, setZipStatus] = useState<AsyncActionStatus>("idle");
  const [mboxStatus, setMboxStatus] = useState<AsyncActionStatus>("idle");

  const handleExportZip = async () => {
    setZipStatus("loading");
    try {
      const saved = await profileApi.exportBackup(
        workspace.activeProfileId,
        includeAtts,
        includeSecrets,
        password,
      );
      if (!saved) {
        setZipStatus("idle");
        return;
      }
      setZipStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.exportedZipBackup"),
        detail: saved,
      });
    } catch (err) {
      setZipStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.exportBackupFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  const handleExportMbox = async () => {
    setMboxStatus("loading");
    try {
      const saved = await mailApi.exportFolderMBOX("inbox");
      if (!saved) {
        setMboxStatus("idle");
        return;
      }
      setMboxStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.exportedInboxMbox"),
        detail: saved,
      });
    } catch (err) {
      setMboxStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.exportMboxFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  const closeToStorage = () =>
    workspace.setOverlay({ type: "settings", tab: "storage" });

  return (
    <ModalShell
      heading={t("overlays.backupHeading")}
      subtitle={t("overlays.backupSubtitle")}
      maxWidth={560}
      onClose={closeToStorage}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("overlays.backupFooterHint")}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={closeToStorage}
          >
            {t("common.done")}
          </button>
        </>
      }
    >
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("overlays.backupZipCardTitle")}
        </strong>
        <div className="text-xs text-muted">
          {t("overlays.backupZipCardDesc")}
        </div>
        <Checkbox
          checked={includeAtts}
          onChange={setIncludeAtts}
          ariaLabel={t("overlays.backupIncludeAttsAria")}
        >
          {t("overlays.backupIncludeAttsLabel")}
        </Checkbox>
        <Checkbox
          checked={includeSecrets}
          onChange={setIncludeSecrets}
          ariaLabel={t("overlays.backupIncludeSecretsAria")}
        >
          {t("overlays.backupIncludeSecretsLabel")}
        </Checkbox>
        {includeSecrets && (
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={t("overlays.backupPasswordPlaceholder")}
            ariaLabel={t("overlays.backupPasswordAria")}
          />
        )}
        <AsyncActionButton
          size="sm"
          status={zipStatus}
          disabled={
            mboxStatus === "loading" || (includeSecrets && password.length < 8)
          }
          style={{ alignSelf: "flex-start" }}
          idleIcon="download"
          idleLabel={t("overlays.backupExportZipIdle")}
          loadingLabel={t("overlays.backupExportZipLoading")}
          successLabel={t("overlays.backupExportZipSuccess")}
          errorLabel={t("overlays.backupExportRetryError")}
          successHoldMs={1000}
          onSuccessHoldEnd={() => setZipStatus("idle")}
          onClick={() => void handleExportZip()}
        />
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("overlays.backupMboxCardTitle")}
        </strong>
        <div className="text-xs text-muted">
          {t("overlays.backupMboxCardDesc")}
        </div>
        <AsyncActionButton
          size="sm"
          variant="secondary"
          status={mboxStatus}
          disabled={zipStatus === "loading"}
          style={{ alignSelf: "flex-start" }}
          idleIcon="download"
          idleLabel={t("overlays.backupExportMboxIdle")}
          loadingLabel={t("overlays.backupExportMboxLoading")}
          successLabel={t("overlays.backupExportMboxSuccess")}
          errorLabel={t("overlays.backupExportRetryError")}
          successHoldMs={1000}
          onSuccessHoldEnd={() => setMboxStatus("idle")}
          onClick={() => void handleExportMbox()}
        />
      </div>
    </ModalShell>
  );
}
