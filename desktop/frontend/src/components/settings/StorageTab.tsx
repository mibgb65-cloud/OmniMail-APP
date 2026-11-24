import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import {
  diagnosticApi,
  parseBackendError,
  type StorageBreakdown,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { formatBytes, isWailsDesktop } from "../../state/storageHelpers";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function StorageTab() {
  const { workspace, desktopBridge, toastStore } = useApp();
  const { t, isEn } = useI18n();
  const { storage } = desktopBridge;
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const colors = ["#2563EB", "#6366F1", "#16A34A", "#D97706", "#64748B"];

  useEffect(() => {
    if (!isWailsDesktop()) return;
    let active = true;
    void diagnosticApi
      .getStorageBreakdown()
      .then((res) => {
        if (active && res) setBreakdown(res);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const totalMb = breakdown
    ? breakdown.totalUsedBytes / (1024 * 1024)
    : workspace.accounts.reduce((sum, a) => sum + a.storageMb, 0);

  const handleClearCache = () => {
    void diagnosticApi
      .clearAttachmentCache()
      .then(async (freed) => {
        const fresh = await diagnosticApi.getStorageBreakdown();
        if (fresh) setBreakdown(fresh);
        await workspace.refreshProfilesAndAccounts();
        toastStore.pushToast({
          tone: "success",
          title: t("toasts.clearedAttCacheTitle", { size: formatBytes(freed) }),
          detail: t("toasts.clearedAttCacheDetail"),
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.clearAttCacheFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>
              {t("settings.storageDirTitle")}
            </strong>
            <div className="text-xs text-muted">
              {t("settings.storageBootstrapSub", {
                path: storage.bootstrapPath,
                free: formatBytes(
                  breakdown?.diskFreeBytes ?? storage.freeBytes,
                ),
              })}
            </div>
          </div>
          <div className="row" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void desktopBridge.openDataDir()}
            >
              <Icon name="folder" size={14} /> {t("settings.storageOpenDirBtn")}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => workspace.setOverlay({ type: "data-dir-migrate" })}
            >
              <Icon name="external" size={14} />{" "}
              {t("settings.storageMigrateDirBtn")}
            </button>
          </div>
        </div>
        <div className="storage-path-box selectable truncate">
          {breakdown?.profileDir || storage.dataDir}
        </div>
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 14 }}>
              {t("settings.storageCasTitle")}
            </strong>
            <div className="text-xs text-muted">
              {breakdown
                ? t("settings.storageBreakdownSub", {
                    db: formatBytes(breakdown.databaseBytes),
                    raw: formatBytes(breakdown.rawMessagesBytes),
                    attachments: formatBytes(breakdown.attachmentsBytes),
                  })
                : t("settings.storageFallbackSub")}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <strong>
              {(totalMb / 1024).toFixed(2)} GB /{" "}
              {workspace.settings.attachmentCacheLimitGb}.00 GB
            </strong>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearCache}
            >
              {t("settings.storageClearCacheBtn")}
            </button>
          </div>
        </div>

        {workspace.accounts.length > 0 && (
          <div className="storage-bar">
            {workspace.accounts.map((acc, idx) => (
              <Tooltip
                key={acc.id}
                label={`${acc.name}${isEn ? ": " : "："}${acc.storageMb} MB`}
                placement="top"
              >
                <div
                  style={{
                    width: `${Math.max(8, (acc.storageMb / Math.max(totalMb, 1)) * 100)}%`,
                    background: colors[idx % colors.length],
                  }}
                />
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.storageQuotaTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.storageQuotaDesc")}
            </div>
          </div>
          <CustomSelect
            value={workspace.settings.attachmentCacheLimitGb}
            ariaLabel={t("settings.storageQuotaAria")}
            options={[
              { value: 1, label: "1 GB" },
              { value: 2, label: "2 GB", hint: t("settings.defaultHint") },
              { value: 5, label: "5 GB" },
            ]}
            onChange={(val) =>
              workspace.updateSettings({ attachmentCacheLimitGb: Number(val) })
            }
          />
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.storageBackupTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.storageBackupDesc")}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => workspace.setOverlay({ type: "backup-migration" })}
          >
            {t("settings.storageOpenBackupBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
