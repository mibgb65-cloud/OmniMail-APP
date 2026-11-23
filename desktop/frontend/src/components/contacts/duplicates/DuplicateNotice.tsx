import { Icon } from "../../common/Icon";
import { useApp } from "../../../state/AppContext";
import { duplicatePreview } from "./duplicateSelection";
import { useDuplicateCenter } from "./DuplicateCenter";

export function DuplicateNotice() {
  const { workspace } = useApp();
  const center = useDuplicateCenter();
  if (center.hidden || !center.groups.length) return null;
  const count = center.groups.length;
  const { emailCount, preview } = duplicatePreview(center.groups);
  const summary = `检测到 ${count} 组重复联系人（共 ${emailCount} 个关联邮箱）`;
  return (
    <div className="contacts-dup-notice" role="region" aria-label={summary}>
      <div className="contacts-dup-notice-copy">
        <Icon name="spam" size={16} />
        <strong className="truncate" title={summary}>
          {summary}
        </strong>
        <span className="contacts-dup-divider" aria-hidden="true">
          ·
        </span>
        <span className="contacts-dup-preview truncate" title={preview}>
          {preview}
        </span>
      </div>
      <div className="contacts-dup-notice-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            workspace.setOverlay({ type: "contact-duplicates", mode: "review" })
          }
        >
          查看并筛选 ({count} 组)
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={center.busy}
          onClick={() =>
            workspace.setOverlay({
              type: "contact-duplicates",
              mode: "confirm-all",
            })
          }
        >
          一键合并全部
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="本次隐藏重复联系人提示"
          onClick={center.dismiss}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
