import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";

export function SyncTab() {
  const { workspace, triggerSyncAll } = useApp();
  const { t } = useI18n();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <strong style={{ fontSize: 14 }}>
            {t("settings.syncStrategyHeading")}
          </strong>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={triggerSyncAll}
          >
            <Icon name="refresh" size={13} /> {t("settings.syncAllNowBtn")}
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.pollIntervalTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.pollIntervalDesc")}
            </div>
          </div>
          <CustomSelect
            value={s.syncIntervalMinutes}
            ariaLabel={t("settings.pollIntervalTitle")}
            options={[
              { value: 1, label: t("settings.every1Min") },
              {
                value: 5,
                label: t("settings.every5Min"),
                hint: t("settings.recommendedHint"),
              },
              { value: 15, label: t("settings.every15Min") },
              { value: 30, label: t("settings.every30Min") },
            ]}
            onChange={(val) =>
              workspace.updateSettings({ syncIntervalMinutes: Number(val) })
            }
          />
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.offlineWindowTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.offlineWindowDesc")}
            </div>
          </div>
          <CustomSelect
            value={s.offlineRetentionDays}
            ariaLabel={t("settings.offlineWindowTitle")}
            options={[
              { value: 30, label: t("settings.last30Days") },
              {
                value: 90,
                label: t("settings.last90Days"),
                hint: t("settings.recommendedHint"),
              },
              { value: 180, label: t("settings.last180Days") },
            ]}
            onChange={(val) =>
              workspace.updateSettings({
                offlineRetentionDays: Number(val) as 30 | 90 | 180,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
