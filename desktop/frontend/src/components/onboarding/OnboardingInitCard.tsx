import { useApp } from "../../state/AppContext";
import type { LanguageCode, ThemePreference } from "../../types/settings";
import { Checkbox } from "../common/Checkbox";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";

interface OnboardingInitCardProps {
  dataDir: string;
  onChangeDataDir: (next: string) => void;
}

export function OnboardingInitCard({
  dataDir,
  onChangeDataDir,
}: OnboardingInitCardProps) {
  const { workspace, desktopBridge } = useApp();
  const s = workspace.settings;

  const handleBrowse = async () => {
    const picked = await desktopBridge.pickDirectory();
    if (picked) onChangeDataDir(picked);
  };

  return (
    <div className="settings-card" style={{ gap: 10, padding: "12px 14px" }}>
      <div className="row-between">
        <strong style={{ fontSize: 13 }}>数据存储位置与桌面偏好</strong>
        <span className="text-xs text-muted">与程序安装目录隔离</span>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <input
          type="text"
          className="input"
          aria-label="首次启动数据存储目录"
          style={{
            flex: 1,
            height: 32,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
          }}
          value={dataDir}
          onChange={(e) => onChangeDataDir(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ height: 32, flexShrink: 0 }}
          onClick={() => void handleBrowse()}
        >
          <Icon name="folder" size={13} /> 更改目录
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <CustomSelect
          compact
          fullWidth
          value={s.themePreference}
          ariaLabel="初始化外观主题"
          options={[
            { value: "system", label: "主题：跟随系统" },
            { value: "light", label: "主题：亮色模式" },
            { value: "dark", label: "主题：深色模式" },
          ]}
          onChange={(val) =>
            workspace.updateSettings({
              themePreference: val as ThemePreference,
            })
          }
        />
        <CustomSelect
          compact
          fullWidth
          value={s.language}
          ariaLabel="初始化显示语言"
          options={[
            { value: "zh-CN", label: "语言：简体中文" },
            { value: "en-US", label: "语言：English" },
          ]}
          onChange={(val) =>
            workspace.updateSettings({ language: val as LanguageCode })
          }
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Checkbox
          checked={s.closeToTray}
          onChange={(v) => workspace.updateSettings({ closeToTray: v })}
          ariaLabel="关闭主窗口时最小化到系统托盘"
        >
          关闭窗口时最小化至系统托盘（取消勾选则直接退出程序）
        </Checkbox>
        <Checkbox
          checked={s.launchAtStartup}
          onChange={(v) => workspace.updateSettings({ launchAtStartup: v })}
          ariaLabel="开机自动静默启动"
        >
          开机自动启动 OmniMail（静默最小化驻留托盘）
        </Checkbox>
      </div>
    </div>
  );
}
