import { useState } from "react";
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
        title: "已导出本地空间 ZIP 备份包",
        detail: saved,
      });
    } catch (err) {
      setZipStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "导出备份失败",
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
        title: "已导出收件箱标准 .mbox 归档文件",
        detail: saved,
      });
    } catch (err) {
      setMboxStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "导出 .mbox 失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading="备份导出与归档迁移"
      subtitle="导出本地空间一致性快照（自动暂停后台同步做 SQLite WAL 检查点）"
      maxWidth={560}
      onClose={() => workspace.setOverlay({ type: "settings", tab: "storage" })}
      footer={
        <>
          <span className="text-xs text-muted">
            默认不导出邮箱密码与 OAuth 令牌
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "storage" })
            }
          >
            完成
          </button>
        </>
      }
    >
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>导出当前本地空间备份包 (.zip)</strong>
        <div className="text-xs text-muted">
          包含本地 SQLite 邮件索引数据库、签名、自定义标签、收件规则与通讯录。
        </div>
        <Checkbox
          checked={includeAtts}
          onChange={setIncludeAtts}
          ariaLabel="包含已下载的附件二进制缓存"
        >
          同时打包本地已下载的附件与原始邮件归档
        </Checkbox>
        <Checkbox
          checked={includeSecrets}
          onChange={setIncludeSecrets}
          ariaLabel="加密导出账户凭据"
        >
          包含加密凭据（需设置独立 AES-256-GCM 导出密码）
        </Checkbox>
        {includeSecrets && (
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="设置至少 8 位备份加密口令"
            ariaLabel="备份加密口令"
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
          idleLabel="立即导出 ZIP 备份包"
          loadingLabel="正在生成一致性快照…"
          successLabel="已导出 ZIP 备份包"
          errorLabel="导出失败 · 重试"
          successHoldMs={1000}
          onSuccessHoldEnd={() => setZipStatus("idle")}
          onClick={() => void handleExportZip()}
        />
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>批量导出标准 .mbox 邮件归档</strong>
        <div className="text-xs text-muted">
          将当前空间收件箱邮件导出为跨客户端兼容的标准 RFC4155 .mbox 文件。
        </div>
        <AsyncActionButton
          size="sm"
          variant="secondary"
          status={mboxStatus}
          disabled={zipStatus === "loading"}
          style={{ alignSelf: "flex-start" }}
          idleIcon="download"
          idleLabel="导出收件箱为 .mbox"
          loadingLabel="正在封装 .mbox 归档…"
          successLabel="已导出 .mbox 归档"
          errorLabel="导出失败 · 重试"
          successHoldMs={1000}
          onSuccessHoldEnd={() => setMboxStatus("idle")}
          onClick={() => void handleExportMbox()}
        />
      </div>
    </ModalShell>
  );
}
