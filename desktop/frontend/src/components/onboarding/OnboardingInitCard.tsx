import { useI18n } from "../../i18n";
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
  const { t } = useI18n();
  const s = workspace.settings;

  const handleBrowse = async () => {
    const picked = await desktopBridge.pickDirectory();
    if (picked) onChangeDataDir(picked);
  };

  return (
    <div className="settings-card" style={{ gap: 10, padding: "12px 14px" }}>
      <div className="row-between">
        <strong style={{ fontSize: 13 }}>
          {t("onboarding.initCardTitle")}
        </strong>
        <span className="text-xs text-muted">
          {t("onboarding.initCardIsolatedHint")}
        </span>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <input
          type="text"
          className="input"
          aria-label={t("onboarding.initDataDirAria")}
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
          <Icon name="folder" size={13} /> {t("onboarding.changeDirBtn")}
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
          ariaLabel={t("onboarding.initThemeAria")}
          options={[
            { value: "system", label: t("onboarding.themeSystemOpt") },
            { value: "light", label: t("onboarding.themeLightOpt") },
            { value: "dark", label: t("onboarding.themeDarkOpt") },
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
          ariaLabel={t("onboarding.initLangAria")}
          options={[
            { value: "zh-CN", label: t("onboarding.langZhOpt") },
            { value: "en-US", label: t("onboarding.langEnOpt") },
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
          ariaLabel={t("onboarding.closeToTrayAria")}
        >
          {t("onboarding.closeToTrayLabel")}
        </Checkbox>
        <Checkbox
          checked={s.launchAtStartup}
          onChange={(v) => workspace.updateSettings({ launchAtStartup: v })}
          ariaLabel={t("onboarding.launchAtStartupAria")}
        >
          {t("onboarding.launchAtStartupLabel")}
        </Checkbox>
      </div>
    </div>
  );
}
