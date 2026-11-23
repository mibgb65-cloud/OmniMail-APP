import { useApp } from "../../state/AppContext";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";

export function SyncTab() {
  const { workspace, triggerSyncAll } = useApp();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <div className="row-between">
          <strong style={{ fontSize: 14 }}>收信与增量同步策略</strong>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={triggerSyncAll}
          >
            <Icon name="refresh" size={13} /> 立即同步全部
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>自动拉取周期</div>
            <div className="text-xs text-muted">
              对不支持 IMAP IDLE 的服务商定时增量拉取
            </div>
          </div>
          <CustomSelect
            value={s.syncIntervalMinutes}
            ariaLabel="自动拉取周期"
            options={[
              { value: 1, label: "每 1 分钟" },
              { value: 5, label: "每 5 分钟", hint: "推荐" },
              { value: 15, label: "每 15 分钟" },
              { value: 30, label: "每 30 分钟" },
            ]}
            onChange={(val) =>
              workspace.updateSettings({ syncIntervalMinutes: Number(val) })
            }
          />
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              本地离线缓存窗口
            </div>
            <div className="text-xs text-muted">
              超出窗口的旧邮件在联网检索时按需拉取正文
            </div>
          </div>
          <CustomSelect
            value={s.offlineRetentionDays}
            ariaLabel="本地离线缓存窗口"
            options={[
              { value: 30, label: "最近 30 天" },
              { value: 90, label: "最近 90 天", hint: "推荐" },
              { value: 180, label: "最近 180 天" },
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
