import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function ComposeDock() {
  const { workspace, composeStore } = useApp();
  const { t, formatTime, localizeText } = useI18n();
  const draft = composeStore.draft;
  if (!draft || !draft.minimized) return null;

  return (
    <div
      className="compose-dock"
      role="region"
      aria-label={t("compose.dockAria")}
    >
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 13, fontWeight: 700 }}>
          {localizeText(draft.subject) || t("compose.untitledDraft")}
        </div>
        <div className="text-xs" style={{ opacity: 0.78 }}>
          {t("compose.dockSavedSub", { time: formatTime(draft.savedAt) })}
        </div>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <button
          type="button"
          className="btn btn-sm"
          style={{
            background: "rgba(255,255,255,0.16)",
            color: "var(--brand-primary-ink)",
          }}
          onClick={() => composeStore.updateDraft({ minimized: false })}
        >
          {t("compose.expandBtn")}
        </button>
        <Tooltip label={t("compose.deleteDraftTip")} placement="top">
          <button
            type="button"
            className="btn-icon"
            style={{ color: "var(--brand-primary-ink)" }}
            aria-label={t("compose.deleteDraftTip")}
            onClick={() =>
              workspace.setOverlay({
                type: "danger-confirm",
                kind: "discard-draft",
              })
            }
          >
            <Icon name="x" size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
