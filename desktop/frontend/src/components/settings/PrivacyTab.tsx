import { useApp } from "../../state/AppContext";
import { SwitchRow } from "./SwitchRow";

export function PrivacyTab() {
  const { workspace, toastStore } = useApp();
  const s = workspace.settings;
  const [savingImagePolicy, setSavingImagePolicy] = useState(false);

  async function saveImagePolicy(blockRemoteImages: boolean) {
    setSavingImagePolicy(true);
    try {
      // 先持久化再刷新阅读器，否则正文可能按旧策略从后端取回。
      const saved = await profileApi.updateAppSettings({ blockRemoteImages });
      workspace.applySettingsFromBackend({
        blockRemoteImages: saved.blockRemoteImages,
      });
    } catch {
      toastStore.pushToast({ tone: "danger", title: "未能保存外部图片设置" });
    } finally {
      setSavingImagePolicy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>邮件读取隐私与反钓鱼</strong>
        <SwitchRow
          heading="默认拦截邮件远程图片与追踪像素"
          desc="关闭后默认加载远程图片；高风险邮件仍会拦截"
          checked={s.blockRemoteImages}
          disabled={savingImagePolicy}
          onChange={(v) => void saveImagePolicy(v)}
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
import { useState } from "react";
import { profileApi } from "../../services/backendClient";
