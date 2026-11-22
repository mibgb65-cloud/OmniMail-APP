import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function BackupMigrationModal() {
  const { workspace, toastStore } = useApp();
  const [encryptBackup, setEncryptBackup] = useState(true);

  return (
    <ModalShell
      title="备份导出与本地迁移"
      subtitle="支持导出加密配置快照，或从其他客户端导入标准 .eml / .mbox 归档"
      maxWidth={560}
      onClose={() => workspace.setOverlay({ type: "settings", tab: "storage" })}
      footer={
        <>
          <span className="text-xs text-muted">
            默认不导出邮箱密码与 OAuth 刷新令牌
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
        <strong style={{ fontSize: 14 }}>导出工作空间配置包</strong>
        <div className="text-xs text-muted">
          包含账户服务器列表、签名、自定义标签、收件规则与联系人分组（不含敏感密钥明文）。
        </div>
        <label className="row" style={{ fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={encryptBackup}
            onChange={(e) => setEncryptBackup(e.target.checked)}
          />
          <span>使用 AES-256 口令加密导出文件（推荐）</span>
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() =>
            toastStore.pushToast({
              tone: "success",
              title: "已导出 OmniMail 备份包",
              detail: encryptBackup
                ? "omnimail-backup-20261120.omni.enc（已加密）"
                : "omnimail-backup-20261120.json",
            })
          }
        >
          <Icon name="download" size={14} /> 立即导出配置备份
        </button>
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          从本地文件导入邮件（.eml / .mbox）
        </strong>
        <div className="text-xs text-muted">
          导入历史归档邮件至本地只读归档区，不影响远程邮箱服务器配额。
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() =>
            toastStore.pushToast({
              tone: "success",
              title: "已导入 12 封本地归档邮件",
              detail: "已加入本地搜索索引",
            })
          }
        >
          <Icon name="upload" size={14} /> 选择 .eml / .mbox 文件导入
        </button>
      </div>
    </ModalShell>
  );
}
