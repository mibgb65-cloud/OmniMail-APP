import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { SwitchRow } from "./SwitchRow";

export function PrivacyTab() {
  const { workspace } = useApp();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>邮件读取隐私与反钓鱼</strong>
        <SwitchRow
          title="默认拦截陌生发件人远程图片与追踪像素"
          desc="防止发件人获知你的打开时间与 IP，阅读时可单封手动加载"
          checked={s.blockRemoteImages}
          onChange={(v) => workspace.updateSettings({ blockRemoteImages: v })}
        />
        <SwitchRow
          title="开启 SPF / DKIM / DMARC 钓鱼风险校验"
          desc="检测到发件域伪造或异常链接时展示醒目风险警示，并自动禁用 AI 读取"
          checked={s.phishingCheckEnabled}
          onChange={(v) =>
            workspace.updateSettings({ phishingCheckEnabled: v })
          }
        />
        <SwitchRow
          title="本地缓存与凭据库加密保护"
          desc="邮件正文索引与 OAuth / 授权码凭据均由本机密钥隔离保护"
          checked={s.localEncryptionEnabled}
          onChange={(v) =>
            workspace.updateSettings({ localEncryptionEnabled: v })
          }
        />
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 14, color: "var(--status-danger)" }}>
              清除全部本地数据并重置应用
            </strong>
            <div className="text-xs text-muted">
              不可逆清除本地邮件缓存、规则、联系人与账户配置（不删除云端邮件）
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              workspace.setOverlay({
                type: "danger-confirm",
                kind: "wipe-local-data",
              })
            }
          >
            清除本地数据
          </button>
        </div>
      </div>
    </div>
  );
}

export function StorageTab() {
  const { workspace, toastStore } = useApp();
  const totalMb = workspace.accounts.reduce((sum, a) => sum + a.storageMb, 0);
  const colors = ["#2563EB", "#6366F1", "#16A34A", "#D97706", "#64748B"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 14 }}>本地数据与缓存占用</strong>
            <div className="text-xs text-muted">
              数据目录：%LOCALAPPDATA%\OmniMail\workspace.db
            </div>
          </div>
          <strong>{(totalMb / 1024).toFixed(2)} GB / 5.00 GB</strong>
        </div>

        <div className="storage-bar">
          {workspace.accounts.map((acc, idx) => (
            <div
              key={acc.id}
              title={`${acc.name}：${acc.storageMb} MB`}
              style={{
                width: `${Math.max(8, (acc.storageMb / Math.max(totalMb, 1)) * 100)}%`,
                background: colors[idx % colors.length],
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workspace.accounts.map((acc, idx) => (
            <div key={acc.id} className="row-between" style={{ fontSize: 13 }}>
              <span className="row">
                <span
                  className="label-dot"
                  style={{ background: colors[idx % colors.length] }}
                />
                <span>{acc.name}</span>
              </span>
              <div className="row">
                <span className="text-xs text-muted">{acc.storageMb} MB</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    workspace.updateAccount(acc.id, {
                      storageMb: Math.max(48, Math.round(acc.storageMb * 0.45)),
                    });
                    toastStore.pushToast({
                      tone: "success",
                      title: `已清理 ${acc.shortTag} 附件缓存`,
                    });
                  }}
                >
                  清理缓存
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              本地全文搜索索引
            </div>
            <div className="text-xs text-muted">
              若检索结果不完整，可无损重建本地 SQLite FTS 索引
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              toastStore.pushToast({
                tone: "success",
                title: "本地搜索索引重建完成",
                detail: "已校验 240 封邮件正文与主题词条",
              })
            }
          >
            <Icon name="database" size={14} /> 重建搜索索引
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              附件离线缓存上限
            </div>
            <div className="text-xs text-muted">
              达到上限后按最近最少使用自动回收旧附件
            </div>
          </div>
          <select
            className="select"
            value={workspace.settings.attachmentCacheLimitGb}
            onChange={(e) =>
              workspace.updateSettings({
                attachmentCacheLimitGb: Number(e.target.value),
              })
            }
          >
            <option value={1}>1 GB</option>
            <option value={2}>2 GB（默认）</option>
            <option value={5}>5 GB</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              导入、导出与加密备份迁移
            </div>
            <div className="text-xs text-muted">
              导出账户配置、收件规则与签名，或导入 .eml / .mbox
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => workspace.setOverlay({ type: "backup-migration" })}
          >
            打开备份与迁移
          </button>
        </div>
      </div>
    </div>
  );
}
