import { profileApi, type ProfileSummary } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";

export function ProfileSwitchList({
  busy,
  askOnLaunch,
  onToggleAskOnLaunch,
  onSelectSwitch,
  onSelectUnlock,
}: {
  busy: boolean;
  askOnLaunch: boolean;
  onToggleAskOnLaunch: (checked: boolean) => void;
  onSelectSwitch: (p: ProfileSummary) => void;
  onSelectUnlock: (p: ProfileSummary) => void;
}) {
  const { workspace } = useApp();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {workspace.profiles.map((p) => {
        const isCur = p.id === workspace.activeProfileId;
        return (
          <div
            key={p.id}
            className="settings-card"
            style={{ padding: "10px 14px" }}
          >
            <div className="row-between">
              <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
                <div
                  className="profile-avatar"
                  style={{ background: p.color, color: "#fff" }}
                >
                  {p.badge}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <strong className="truncate" style={{ fontSize: 13.5 }}>
                      {p.name}
                    </strong>
                    {isCur && (
                      <span className="pill pill-accent">当前活跃</span>
                    )}
                    {p.pinEnabled && (
                      <span className="pill pill-neutral">
                        <Icon name="lock" size={11} /> PIN
                      </span>
                    )}
                  </div>
                  <div
                    className="text-xs text-muted truncate"
                    title={p.profileDir}
                  >
                    {p.accountCount} 个邮箱账户 · {p.profileDir}
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {!isCur && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() =>
                      p.locked ? onSelectUnlock(p) : onSelectSwitch(p)
                    }
                  >
                    切换
                  </button>
                )}
                {!isCur && workspace.profiles.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() =>
                      workspace.setOverlay({
                        type: "danger-confirm",
                        kind: "delete-profile",
                        targetId: p.id,
                        targetLabel: p.name,
                      })
                    }
                    aria-label={`删除空间 ${p.name}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <Checkbox
        checked={askOnLaunch}
        onChange={(checked) => {
          onToggleAskOnLaunch(checked);
          if (workspace.activeProfile) {
            void profileApi.updateProfile({
              id: workspace.activeProfile.id,
              launchBehavior: checked ? "ask-on-launch" : "last-profile",
            });
          }
        }}
        ariaLabel="启动时弹出本地工作空间选择器"
      >
        启动 OmniMail 时弹出本地工作空间选择器
      </Checkbox>
    </div>
  );
}
