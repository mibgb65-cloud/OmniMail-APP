import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import {
  formatBytes,
  type MigrationResult,
  type TargetDirCheck,
} from "../../state/storageHelpers";
import {
  AsyncActionButton,
  waitSuccessHold,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function DataDirMigrateModal() {
  const { workspace, desktopBridge, toastStore } = useApp();
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
  }, [desktopBridge, targetPath]);

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
        title: "本地数据目录已完成安全迁移",
        detail: `bootstrap.json 已指向 ${res.newDataDir}`,
      });
      await waitSuccessHold(900);
      setDoneResult(res);
    } catch (err) {
      setStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "数据目录迁移失败",
        detail: err instanceof Error ? err.message : "请检查目录读写权限",
      });
    }
  };

  const busyOrDone =
    Boolean(doneResult) || status === "loading" || status === "success";
  const checkValid = Boolean(check?.valid && !check.sameAsCurrent);
  const backToStorage = () =>
    workspace.setOverlay({ type: "settings", tab: "storage" });

  return (
    <ModalShell
      heading="更改本地数据存储位置"
      subtitle="安全迁移本地 SQLite 库、邮件正文/附件缓存、搜索索引与日志，并更新 bootstrap.json"
      maxWidth={580}
      onClose={backToStorage}
      footer={
        doneResult ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={backToStorage}
            >
              稍后手动重启
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void desktopBridge.restartApp()}
            >
              <Icon name="refresh" size={14} /> 立即重启 OmniMail 生效
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busyOrDone}
              onClick={backToStorage}
            >
              取消
            </button>
            <AsyncActionButton
              status={status}
              disabled={!checkValid}
              idleIcon="database"
              idleLabel="开始迁移并更新引导配置"
              loadingLabel="正在校验并迁移数据…"
              successLabel="迁移完成 · 引导已更新"
              errorLabel="迁移失败 · 点击重试"
              onClick={() => void handleMigrate()}
            />
          </>
        )
      }
    >
      <div className="settings-card">
        <div className="text-xs text-muted">
          当前数据目录（已占用 {formatBytes(storage.usedBytes)}）
        </div>
        <div className="storage-path-box selectable truncate">
          {storage.dataDir}
        </div>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          选择新的数据存储目录
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
            placeholder="例如 D:\OmniMailData"
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busyOrDone}
            onClick={() => void handleBrowse()}
          >
            <Icon name="folder" size={14} /> 浏览选择…
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
            {check.freeBytes > 0 && (
              <div>
                可用：{formatBytes(check.freeBytes)} · 需：
                {formatBytes(check.requiredBytes)}
              </div>
            )}
          </div>
        )}
        {doneResult ? (
          <div className="migrate-status-box" data-tone="ok">
            <strong>
              已复制 {doneResult.copiedFiles} 个文件（
              {formatBytes(doneResult.copiedBytes)}）至 {doneResult.newDataDir}
            </strong>
            <div>
              引导文件 {storage.bootstrapPath} 已原子更新，建议立即重启生效。
            </div>
          </div>
        ) : (
          <Checkbox
            checked={keepSource}
            onChange={setKeepSource}
            ariaLabel="保留原目录数据副本"
          >
            保留原目录数据副本（推荐，重启确认无误后再手动删除旧副本）
          </Checkbox>
        )}
      </div>
    </ModalShell>
  );
}
