import { useApp } from "../../state/AppContext";
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
          <select
            className="select"
            value={s.syncIntervalMinutes}
            onChange={(e) =>
              workspace.updateSettings({
                syncIntervalMinutes: Number(e.target.value),
              })
            }
          >
            <option value={1}>每 1 分钟</option>
            <option value={5}>每 5 分钟（推荐）</option>
            <option value={15}>每 15 分钟</option>
            <option value={30}>每 30 分钟</option>
          </select>
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
          <select
            className="select"
            value={s.offlineRetentionDays}
            onChange={(e) =>
              workspace.updateSettings({
                offlineRetentionDays: Number(e.target.value) as 30 | 90 | 180,
              })
            }
          >
            <option value={30}>最近 30 天</option>
            <option value={90}>最近 90 天（推荐）</option>
            <option value={180}>最近 180 天</option>
          </select>
        </div>
      </div>
    </div>
  );
}
