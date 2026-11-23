import { SetLaunchAtLogin } from "../../../bindings/omnimail/desktopservice";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { CustomSelect } from "../common/CustomSelect";
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
              亮色工作台、Obsidian Slate 深色模式或自动跟随系统外观
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className={`btn btn-sm ${s.themePreference === "light" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.updateSettings({ themePreference: "light" })
              }
            >
              <Icon name="sun" size={13} /> 亮色
            </button>
            <button
              type="button"
              className={`btn btn-sm ${s.themePreference === "dark" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.updateSettings({ themePreference: "dark" })
              }
            >
              <Icon name="moon" size={13} /> 深色
            </button>
            <button
              type="button"
              className={`btn btn-sm ${s.themePreference === "system" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.updateSettings({ themePreference: "system" })
              }
            >
              <Icon name="sliders" size={13} /> 跟随系统
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>界面语言</div>
            <div className="text-xs text-muted">
              默认简体中文，同步切换顶部快捷语言菜单与本地化设置
            </div>
          </div>
          <CustomSelect
            value={s.language}
            ariaLabel="选择界面语言"
            options={[
              { value: "zh-CN", label: "简体中文", hint: "默认" },
              { value: "en-US", label: "English (US)" },
            ]}
            onChange={(val) =>
              workspace.updateSettings({
                language: val as "zh-CN" | "en-US",
              })
            }
          />
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>列表信息密度</div>
            <div className="text-xs text-muted">
              控制中栏邮件卡片间距与摘要展示行数
            </div>
          </div>
          <CustomSelect
            value={s.density}
            ariaLabel="选择列表信息密度"
            options={[
              { value: "comfortable", label: "舒适（默认）" },
              { value: "compact", label: "紧凑" },
            ]}
            onChange={(val) =>
              workspace.updateSettings({
                density: val as "comfortable" | "compact",
              })
            }
          />
        </div>
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>桌面端集成与通知</strong>
        <SwitchRow
          heading="开机自动启动 OmniMail"
          desc="写入当前用户注册表自启项（无需管理员权限）"
          checked={s.launchAtStartup}
          onChange={(v) => {
            workspace.updateSettings({ launchAtStartup: v });
            if (isWailsDesktop()) {
              void SetLaunchAtLogin(v, Boolean(s.silentStartToTray));
            }
          }}
        />
        <SwitchRow
          heading="开机时静默驻留系统托盘（跳过开屏与主窗口）"
          desc="附加 --silent-tray 参数，登录系统后不打扰桌面并在后台静默收信"
          checked={Boolean(s.silentStartToTray)}
          onChange={(v) => {
            workspace.updateSettings({ silentStartToTray: v });
            if (isWailsDesktop()) {
              void SetLaunchAtLogin(s.launchAtStartup, v);
            }
          }}
        />
        <SwitchRow
          heading="关闭主窗口时最小化至系统托盘"
          desc="关闭时隐藏至托盘保持后台监听；关闭此开关则点击右上角 × 直接退出进程"
          checked={s.closeToTray}
          onChange={(v) => workspace.updateSettings({ closeToTray: v })}
        />
        <SwitchRow
          heading="新邮件桌面通知"
          desc="VIP 与主收件箱新邮件弹出系统横幅提醒"
          checked={s.showDesktopNotifications}
          onChange={(v) =>
            workspace.updateSettings({ showDesktopNotifications: v })
          }
        />
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              托盘菜单与首次启动引导
            </div>
            <div className="text-xs text-muted">
              查看系统托盘快捷动作、权限引导或重新打开初始化引导页
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
