import { SetLaunchAtLogin } from "../../../bindings/omnimail/desktopservice";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";
import { SwitchRow } from "./SwitchRow";

export function GeneralTab() {
  const { workspace } = useApp();
  const { t } = useI18n();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            <button
              type="button"
              className={`btn btn-sm ${s.themePreference === "light" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.updateSettings({ themePreference: "light" })
              }
            >
              <Icon name="sun" size={13} /> {t("settings.themeLight")}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${s.themePreference === "dark" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.updateSettings({ themePreference: "dark" })
              }
            >
              <Icon name="moon" size={13} /> {t("settings.themeDark")}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${s.themePreference === "system" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                workspace.updateSettings({ themePreference: "system" })
              }
            >
              <Icon name="sliders" size={13} /> {t("settings.themeSystem")}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.languageTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.languageDesc")}
            </div>
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
              workspace.updateSettings({
                language: val as "zh-CN" | "en-US",
              })
            }
          />
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.densityTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.densityDesc")}
            </div>
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

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("settings.desktopIntegrationSection")}
        </strong>
        <SwitchRow
          heading={t("settings.launchAtStartupTitle")}
          desc={t("settings.launchAtStartupDesc")}
          checked={s.launchAtStartup}
          onChange={(v) => {
            workspace.updateSettings({ launchAtStartup: v });
            if (isWailsDesktop()) {
              void SetLaunchAtLogin(v, Boolean(s.silentStartToTray));
            }
          }}
        />
        <SwitchRow
          heading={t("settings.silentTrayTitle")}
          desc={t("settings.silentTrayDesc")}
          checked={Boolean(s.silentStartToTray)}
          onChange={(v) => {
            workspace.updateSettings({ silentStartToTray: v });
            if (isWailsDesktop()) {
              void SetLaunchAtLogin(s.launchAtStartup, v);
            }
          }}
        />
        <SwitchRow
          heading={t("settings.closeToTrayTitle")}
          desc={t("settings.closeToTrayDesc")}
          checked={s.closeToTray}
          onChange={(v) => workspace.updateSettings({ closeToTray: v })}
        />
        <SwitchRow
          heading={t("settings.desktopNotifyTitle")}
          desc={t("settings.desktopNotifyDesc")}
          checked={s.showDesktopNotifications}
          onChange={(v) =>
            workspace.updateSettings({ showDesktopNotifications: v })
          }
        />
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.trayAndOnboardingTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.trayAndOnboardingDesc")}
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
              {t("settings.trayPreviewBtn")}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                workspace.setOverlay({ type: "none" });
                workspace.setScreen("onboarding");
              }}
            >
              {t("settings.onboardingPageBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
