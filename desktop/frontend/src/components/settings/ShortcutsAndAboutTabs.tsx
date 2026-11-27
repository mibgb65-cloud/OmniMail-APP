import { getShortcutGroups, useI18n } from "../../i18n";
import { DEFAULT_GITHUB_RELEASES_URL } from "../../services/updaterApi";
import { useApp } from "../../state/AppContext";
import { openSafeExternalUrl } from "../../state/desktopActions";
import { Icon } from "../common/Icon";
import { AboutVersionCard } from "./AboutVersionCard";
import { SwitchRow } from "./SwitchRow";

export function ShortcutsTab() {
  const { lang } = useI18n();
  const groups = getShortcutGroups(lang);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((group) => (
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

export function AboutTab() {
  const { workspace, updateStore } = useApp();
  const { t } = useI18n();
  const { prefs, checkResult } = updateStore;
  const activeChannel = prefs.updateChannel === "beta" ? "beta" : "stable";
  const githubReleaseUrl =
    checkResult?.releaseUrl || DEFAULT_GITHUB_RELEASES_URL;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <AboutVersionCard />

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("updater.aboutPrefsCardTitle")}
        </strong>

        <SwitchRow
          heading={t("updater.aboutAutoCheckTitle")}
          desc={t("updater.aboutAutoCheckDesc")}
          checked={prefs.autoCheckUpdates}
          onChange={(v) => void updateStore.setAutoCheck(v)}
        />

        <div className="settings-row">
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-ink)",
              }}
            >
              {t("updater.aboutChannelTitle")}
            </div>
            <div
              className="text-xs text-muted"
              style={{ marginTop: 2, lineHeight: 1.5 }}
            >
              {t("updater.aboutChannelDesc")}
            </div>
          </div>

          <div
            className="about-channel-seg"
            role="group"
            aria-label={t("updater.aboutChannelTitle")}
          >
            <button
              type="button"
              className={`about-channel-seg-btn${activeChannel === "stable" ? " active" : ""}`}
              onClick={() => void updateStore.setChannel("stable")}
            >
              {t("updater.aboutChannelStable")}
            </button>
            <button
              type="button"
              className={`about-channel-seg-btn${activeChannel === "beta" ? " active" : ""}`}
              onClick={() => void updateStore.setChannel("beta")}
            >
              {t("updater.aboutChannelBeta")}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-ink)",
              }}
            >
              {t("updater.aboutSecurityTitle")}
            </div>
            <div
              className="text-xs text-muted"
              style={{ marginTop: 2, lineHeight: 1.5 }}
            >
              {t("updater.aboutSecurityDesc")}
            </div>
          </div>
          <span className="pill pill-success" style={{ flexShrink: 0 }}>
            <Icon name="shield" size={13} />
            <span>{t("updater.aboutSecurityBadge")}</span>
          </span>
        </div>
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("updater.aboutLinksCardTitle")}
        </strong>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void openSafeExternalUrl(githubReleaseUrl)}
          >
            <Icon name="external" size={13} />
            <span>{t("updater.aboutGithubReleasesBtn")}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "legal-doc", doc: "terms" })
            }
          >
            {t("updater.aboutTermsCleanBtn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({ type: "legal-doc", doc: "privacy" })
            }
          >
            {t("updater.aboutPrivacyCleanBtn")}
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
            {t("settings.aboutExportDiagBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
