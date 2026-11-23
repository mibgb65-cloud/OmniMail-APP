import { parseBackendError, profileApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function ProfileSwitcherCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { viewport, workspace, toastStore } = useApp();
  const active = workspace.activeProfile;
  const badge = active?.badge || "个";
  const name = active?.name || "个人工作空间";
  const bg = active?.color || "#141E2E";

  const handleLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!active) return;
    try {
      await profileApi.lockProfile(active.id);
      await workspace.refreshProfilesAndAccounts();
      workspace.setOverlay({
        type: "profile-manage",
        mode: "unlock",
        targetProfileId: active.id,
      });
      toastStore.pushToast({
        tone: "info",
        title: `已锁定空间「${active.name}」`,
      });
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: "锁定空间失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <div
      className={`profile-card ${compact ? "profile-card-drawer" : ""}`}
      style={{ cursor: "pointer" }}
      onClick={() =>
        workspace.setOverlay({ type: "profile-manage", mode: "switch" })
      }
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          workspace.setOverlay({ type: "profile-manage", mode: "switch" });
        }
      }}
      aria-label="切换或管理本地工作空间"
    >
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <div
          className="profile-avatar"
          style={{
            background: bg,
            color: "#ffffff",
            width: compact ? 24 : undefined,
            height: compact ? 24 : undefined,
          }}
        >
          {badge}
        </div>
        <div className="account-row-meta">
          <span className="profile-name truncate">{name}</span>
          {!compact && viewport !== "laptop" && (
            <span className="profile-sub truncate">
              {workspace.profiles.length > 1
                ? `${workspace.profiles.length} 个本地空间 · 点击切换`
                : active?.pinEnabled
                  ? "PIN 保护已启用"
                  : "本地物理隔离空间"}
            </span>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 2, flexShrink: 0 }}>
        {active?.pinEnabled && !compact && (
          <Tooltip label="立即上锁当前空间">
            <button
              type="button"
              className="icon-btn"
              style={{ width: 26, height: 26 }}
              onClick={(e) => void handleLock(e)}
              aria-label="锁定工作空间"
            >
              <Icon name="lock" size={13} />
            </button>
          </Tooltip>
        )}
        <Icon name="chevronUp" size={13} />
      </div>
    </div>
  );
}
