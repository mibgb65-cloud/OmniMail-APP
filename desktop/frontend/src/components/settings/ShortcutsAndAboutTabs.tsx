import { SHORTCUT_GROUPS } from "../../data/settingsDefaults";
import { useApp } from "../../state/AppContext";
import type { RuntimeBannerMode } from "../../types/ui";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";

export function ShortcutsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.group} className="settings-card">
          <strong style={{ fontSize: 14 }}>{group.group}</strong>
          {group.items.map((item) => (
            <div key={item.desc} className="settings-row">
              <span style={{ fontSize: 13 }}>{item.desc}</span>
              <span className="row" style={{ gap: 4 }}>
                {item.keys.map((k) => (
                  <kbd key={k} className="kbd">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const BANNER_OPTIONS: Array<{ id: RuntimeBannerMode; label: string }> = [
  { id: "none", label: "正常无横幅" },
  { id: "offline", label: "离线模式" },
  { id: "auth-expired", label: "授权失效" },
  { id: "auto-reply", label: "休假自动回复中" },
  { id: "partial-sync", label: "部分同步失败" },
];

export function AboutTab() {
  const { workspace, toastStore } = useApp();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <div className="row" style={{ gap: 12 }}>
            <BrandLogo size={40} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                OmniMail Desktop
              </div>
              <div className="text-xs text-muted">
                版本 0.1.0-preview · Wails v3 + React + TypeScript
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "update-flow", stage: "checking" })
            }
          >
            <Icon name="refresh" size={14} /> 检查更新
          </button>
        </div>

        <div className="settings-row">
          <span className="text-xs text-muted">
            本地优先的多邮箱桌面客户端，支持亮暗双模式、原收件账户锁定与透明边界
            AI 助手。
          </span>
        </div>

        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "legal-doc", doc: "terms" })
            }
          >
            查看《用户协议》草案
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "legal-doc", doc: "privacy" })
            }
          >
            查看《隐私政策》草案
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({
                type: "diagnostics",
                accountId: workspace.accounts[0]?.id ?? "acc-gmail",
              })
            }
          >
            导出脱敏诊断日志
          </button>
        </div>
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          工作台运行态横幅预览（界面验收入口）
        </strong>
        <div className="text-xs text-muted">
          一键切换工作台顶部横幅状态，快速校验离线、授权失效、自动回复与部分同步失败视图
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {BANNER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn btn-sm ${
                workspace.bannerMode === opt.id
                  ? "btn-primary"
                  : "btn-secondary"
              }`}
              onClick={() => {
                workspace.setBannerMode(opt.id);
                toastStore.pushToast({
                  tone: "info",
                  title: `已切换顶部横幅状态：${opt.label}`,
                });
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
