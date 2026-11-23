import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function ComposeDock() {
  const { workspace, composeStore } = useApp();
  const draft = composeStore.draft;
  if (!draft || !draft.minimized) return null;

  return (
    <div className="compose-dock" role="region" aria-label="最小化草稿栏">
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 13, fontWeight: 700 }}>
          {draft.subject || "未命名邮件草稿"}
        </div>
        <div className="text-xs" style={{ opacity: 0.78 }}>
          已保存于 {draft.savedAt} · 点击恢复继续编辑
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
          展开
        </button>
        <Tooltip label="删除草稿" placement="top">
          <button
            type="button"
            className="btn-icon"
            style={{ color: "var(--brand-primary-ink)" }}
            aria-label="删除草稿"
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
