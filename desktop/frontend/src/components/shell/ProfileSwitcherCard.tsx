import { useI18n } from "../../i18n";
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
  const { t, localizeText } = useI18n();
  const active = workspace.activeProfile;
  const badge = localizeText(active?.badge || t("common.personalBadge"));
  const name = localizeText(active?.name || t("common.personalWorkspace"));
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
        title: t("toasts.profileLocked", { name: localizeText(active.name) }),
      });
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.lockProfileFailed"),
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
      aria-label={t("sidebar.manageProfilesAria")}
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
                ? t("sidebar.profilesCountSub", {
                    count: workspace.profiles.length,
                  })
                : active?.pinEnabled
                  ? t("sidebar.pinProtectedSub")
                  : t("sidebar.isolatedProfileSub")}
            </span>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 2, flexShrink: 0 }}>
        {active?.pinEnabled && !compact && (
          <Tooltip label={t("sidebar.lockProfileNowTip")}>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 26, height: 26 }}
              onClick={(e) => void handleLock(e)}
              aria-label={t("sidebar.lockWorkspaceAria")}
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
