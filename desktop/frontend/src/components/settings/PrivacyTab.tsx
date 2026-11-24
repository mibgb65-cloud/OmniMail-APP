import { useState } from "react";
import { useI18n } from "../../i18n";
import { profileApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  clearTrustedDomains,
  listTrustedDomains,
} from "../mail/reader/externalLinkGuard";
import { SwitchRow } from "./SwitchRow";

export function PrivacyTab() {
  const { workspace, toastStore } = useApp();
  const { t } = useI18n();
  const s = workspace.settings;
  const [savingImagePolicy, setSavingImagePolicy] = useState(false);
  const [, setTrustedVersion] = useState(0);
  const trustedDomains = listTrustedDomains(workspace.activeProfileId);

  const handleClearTrusted = () => {
    clearTrustedDomains(workspace.activeProfileId);
    setTrustedVersion((v) => v + 1);
    toastStore.pushToast({
      tone: "info",
      title: t("externalLink.settingsClearedToast"),
    });
  };

  async function saveImagePolicy(blockRemoteImages: boolean) {
    setSavingImagePolicy(true);
    try {
      // 先持久化再刷新阅读器，否则正文可能按旧策略从后端取回。
      const saved = await profileApi.updateAppSettings({ blockRemoteImages });
      workspace.applySettingsFromBackend({
        blockRemoteImages: saved.blockRemoteImages,
      });
    } catch {
      toastStore.pushToast({
        tone: "danger",
        title: t("settings.privacySaveImageFailed"),
      });
    } finally {
      setSavingImagePolicy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>{t("settings.privacySection")}</strong>
        <SwitchRow
          heading={t("settings.privacyBlockRemoteTitle")}
          desc={t("settings.privacyBlockRemoteDesc")}
          checked={s.blockRemoteImages}
          disabled={savingImagePolicy}
          onChange={(v) => void saveImagePolicy(v)}
        />
        <SwitchRow
          heading={t("settings.privacyPhishingTitle")}
          desc={t("settings.privacyPhishingDesc")}
          checked={s.phishingCheckEnabled}
          onChange={(v) =>
            workspace.updateSettings({ phishingCheckEnabled: v })
          }
        />
        <SwitchRow
          heading={t("settings.privacyEncryptionTitle")}
          desc={t("settings.privacyEncryptionDesc")}
          checked={s.localEncryptionEnabled}
          onChange={(v) =>
            workspace.updateSettings({ localEncryptionEnabled: v })
          }
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
              {t("externalLink.settingsTitle")}
            </div>
            <div
              className="text-xs text-muted"
              style={{ marginTop: 2, lineHeight: 1.5 }}
            >
              {trustedDomains.length > 0
                ? t("externalLink.settingsCountDesc", {
                    count: trustedDomains.length,
                  })
                : t("externalLink.settingsEmptyDesc")}
            </div>
          </div>
          {trustedDomains.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearTrusted}
            >
              {t("externalLink.settingsClearBtn")}
            </button>
          )}
        </div>
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 14, color: "var(--status-danger)" }}>
              {t("settings.privacyWipeTitle")}
            </strong>
            <div className="text-xs text-muted">
              {t("settings.privacyWipeDesc")}
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
            {t("settings.privacyWipeBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
