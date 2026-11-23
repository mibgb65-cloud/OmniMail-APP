import { useEffect, useState } from "react";
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
          title: `已清理本地附件缓存（释放 ${formatBytes(freed)}）`,
          detail: "邮件正文与附件元数据已保留，需要时可随时按需重新下载",
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: "清理附件缓存失败",
          detail: parseBackendError(err).message,
        }),
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>本地数据存储目录</strong>
            <div className="text-xs text-muted">
              引导文件：{storage.bootstrapPath} · 磁盘可用{" "}
              {formatBytes(breakdown?.diskFreeBytes ?? storage.freeBytes)}
            </div>
          </div>
          <div className="row" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void desktopBridge.openDataDir()}
            >
              <Icon name="folder" size={14} /> 打开数据目录
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => workspace.setOverlay({ type: "data-dir-migrate" })}
            >
              <Icon name="external" size={14} /> 迁移数据目录
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
            <strong style={{ fontSize: 14 }}>本地数据库与 CAS 缓存构成</strong>
            <div className="text-xs text-muted">
              {breakdown
                ? `SQLite 库 ${formatBytes(breakdown.databaseBytes)} · 原始邮件 ${formatBytes(breakdown.rawMessagesBytes)} · 附件缓存 ${formatBytes(breakdown.attachmentsBytes)}`
                : "包含本地 SQLite 库、邮件正文、附件缓存与全文索引"}
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
              清理附件缓存
            </button>
          </div>
        </div>

        {workspace.accounts.length > 0 && (
          <div className="storage-bar">
            {workspace.accounts.map((acc, idx) => (
              <Tooltip
                key={acc.id}
                label={`${acc.name}：${acc.storageMb} MB`}
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
              附件离线缓存上限（LRU 自动回收）
            </div>
            <div className="text-xs text-muted">
              达到上限后按最近最少访问自动回收非内联大附件
            </div>
          </div>
          <CustomSelect
            value={workspace.settings.attachmentCacheLimitGb}
            ariaLabel="附件离线缓存上限"
            options={[
              { value: 1, label: "1 GB" },
              { value: 2, label: "2 GB", hint: "默认" },
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
              备份导出与 .mbox 批量归档
            </div>
            <div className="text-xs text-muted">
              导出当前空间完整 ZIP 备份包或批量导出收件箱为标准 .mbox
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => workspace.setOverlay({ type: "backup-migration" })}
          >
            打开备份与导出
          </button>
        </div>
      </div>
    </div>
  );
}
