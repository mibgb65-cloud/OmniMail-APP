import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";

const THEME_OPTIONS = [
  ["light", "sun", "settings.themeLight"],
  ["dark", "moon", "settings.themeDark"],
  ["system", "sliders", "settings.themeSystem"],
] as const;

const DARK_HTML_OPTIONS = [
  ["adaptive", "moon", "reader.htmlThemeAdaptive"],
  ["paper", "sun", "reader.htmlThemePaper"],
] as const;

export function AppearanceCard() {
  const { workspace } = useApp();
  const { t } = useI18n();
  const s = workspace.settings;

  return (
    <div className="settings-card">
      <strong style={{ fontSize: 14 }}>
        {t("settings.appearanceSection")}
      </strong>
      <div className="settings-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t("settings.themeTitle")}
          </div>
          <div className="text-xs text-muted">{t("settings.themeDesc")}</div>
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          {THEME_OPTIONS.map(([val, icon, labelKey]) => (
            <button
              key={val}
              type="button"
              className={`btn btn-sm ${s.themePreference === val ? "btn-primary" : "btn-secondary"}`}
              onClick={() => workspace.updateSettings({ themePreference: val })}
            >
              <Icon name={icon} size={13} /> {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t("settings.darkHtmlModeTitle")}
          </div>
          <div className="text-xs text-muted">
            {t("settings.darkHtmlModeDesc")}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          {DARK_HTML_OPTIONS.map(([val, icon, labelKey]) => {
            const active = (s.darkHtmlMode ?? "adaptive") === val;
            return (
              <button
                key={val}
                type="button"
                className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
                onClick={() => workspace.updateSettings({ darkHtmlMode: val })}
              >
                <Icon name={icon} size={13} /> {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t("settings.languageTitle")}
          </div>
          <div className="text-xs text-muted">{t("settings.languageDesc")}</div>
        </div>
        <CustomSelect
          value={s.language}
          ariaLabel={t("settings.languageAria")}
          options={[
            {
              value: "zh-CN",
              label: "简体中文",
              hint: t("settings.defaultHint"),
            },
            { value: "en-US", label: "English (US)" },
          ]}
          onChange={(val) =>
            workspace.updateSettings({ language: val as "zh-CN" | "en-US" })
          }
        />
      </div>

      <div className="settings-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t("settings.densityTitle")}
          </div>
          <div className="text-xs text-muted">{t("settings.densityDesc")}</div>
        </div>
        <CustomSelect
          value={s.density}
          ariaLabel={t("settings.densityAria")}
          options={[
            { value: "comfortable", label: t("settings.densityComfortable") },
            { value: "compact", label: t("settings.densityCompact") },
          ]}
          onChange={(val) =>
            workspace.updateSettings({
              density: val as "comfortable" | "compact",
            })
          }
        />
      </div>
    </div>
  );
}
