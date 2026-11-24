import { useI18n } from "../../i18n";
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
  const { t, localizeText } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {workspace.profiles.map((p) => {
        const isCur = p.id === workspace.activeProfileId;
        const displayName = localizeText(p.name);
        const displayBadge = localizeText(p.badge);
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
                  {displayBadge}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <strong className="truncate" style={{ fontSize: 13.5 }}>
                      {displayName}
                    </strong>
                    {isCur && (
                      <span className="pill pill-accent">
                        {t("overlays.profActiveBadge")}
                      </span>
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
                    {t("overlays.profAccountDirSub", {
                      count: p.accountCount,
                      dir: p.profileDir,
                    })}
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
                    {t("overlays.profSwitchBtn")}
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
                        targetLabel: displayName,
                      })
                    }
                    aria-label={t("overlays.profDeleteAria", {
                      name: displayName,
                    })}
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
        ariaLabel={t("overlays.profAskOnLaunchAria")}
      >
        {t("overlays.profAskOnLaunchLabel")}
      </Checkbox>
    </div>
  );
}
