import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { SwitchRow } from "./SwitchRow";

export function GeneralTab() {
  const { workspace } = useApp();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>外观与排版</strong>
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>界面主题</div>
            <div className="text-xs text-muted">
              亮色清新工作台或 Obsidian Slate 深色模式
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${s.theme === "light" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => workspace.updateSettings({ theme: "light" })}
            >
              <Icon name="sun" size={13} /> 亮色
            </button>
            <button
              type="button"
              className={`btn btn-sm ${s.theme === "dark" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => workspace.updateSettings({ theme: "dark" })}
            >
              <Icon name="moon" size={13} /> 深色
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>界面语言</div>
            <div className="text-xs text-muted">
              默认简体中文，同步切换顶部快捷语言菜单
            </div>
          </div>
          <select
            className="select"
            value={s.language}
            onChange={(e) =>
              workspace.updateSettings({
                language: e.target.value as "zh-CN" | "en-US",
              })
            }
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English (US)</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>列表信息密度</div>
            <div className="text-xs text-muted">
              控制中栏邮件卡片间距与摘要展示行数
            </div>
          </div>
          <select
            className="select"
            value={s.density}
            onChange={(e) =>
              workspace.updateSettings({
                density: e.target.value as "comfortable" | "compact",
              })
            }
          >
            <option value="comfortable">舒适（默认）</option>
            <option value="compact">紧凑</option>
          </select>
        </div>
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>桌面端集成与通知</strong>
        <SwitchRow
          title="开机自动启动 OmniMail"
          desc="登录后在后台静默同步全部已连接邮箱"
          checked={s.launchAtStartup}
          onChange={(v) => workspace.updateSettings({ launchAtStartup: v })}
        />
        <SwitchRow
          title="关闭主窗口时最小化至系统托盘"
          desc="保持后台 IMAP IDLE 监听，不错过重要新邮件"
          checked={s.closeToTray}
          onChange={(v) => workspace.updateSettings({ closeToTray: v })}
        />
        <SwitchRow
          title="新邮件桌面通知"
          desc="VIP 与主收件箱新邮件弹出系统横幅提醒"
          checked={s.showDesktopNotifications}
          onChange={(v) =>
            workspace.updateSettings({ showDesktopNotifications: v })
          }
        />
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              托盘菜单与系统通知权限预览
            </div>
            <div className="text-xs text-muted">
              查看系统托盘快捷动作、权限引导与首次引导页
            </div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                workspace.setOverlay({ type: "desktop-extras", tab: "tray" })
              }
            >
              托盘与通知预览
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                workspace.setOverlay({ type: "none" });
                workspace.setScreen("onboarding");
              }}
            >
              首次引导页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
