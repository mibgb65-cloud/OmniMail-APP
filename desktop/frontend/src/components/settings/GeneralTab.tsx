import { SetLaunchAtLogin } from "../../../bindings/omnimail/desktopservice";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { AppearanceCard } from "./AppearanceCard";
import { SwitchRow } from "./SwitchRow";

export function GeneralTab() {
  const { workspace } = useApp();
  const { t } = useI18n();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <AppearanceCard />

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
