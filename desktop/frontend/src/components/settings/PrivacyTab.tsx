import { useApp } from "../../state/AppContext";
import { SwitchRow } from "./SwitchRow";

export function PrivacyTab() {
  const { workspace } = useApp();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>邮件读取隐私与反钓鱼</strong>
        <SwitchRow
          heading="默认拦截陌生发件人远程图片与追踪像素"
          desc="防止发件人获知你的打开时间与 IP，阅读时可单封手动加载"
          checked={s.blockRemoteImages}
          onChange={(v) => workspace.updateSettings({ blockRemoteImages: v })}
        />
        <SwitchRow
          heading="开启 SPF / DKIM / DMARC 钓鱼风险校验"
          desc="检测到发件域伪造或异常链接时展示醒目风险警示，并自动禁用 AI 读取"
          checked={s.phishingCheckEnabled}
          onChange={(v) =>
            workspace.updateSettings({ phishingCheckEnabled: v })
          }
        />
        <SwitchRow
          heading="本地缓存与凭据库加密保护"
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
