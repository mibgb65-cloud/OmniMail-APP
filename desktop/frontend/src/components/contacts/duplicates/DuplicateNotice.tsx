import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { useDuplicateCenter } from "./DuplicateCenter";
import { duplicatePreview } from "./duplicateSelection";

export function DuplicateNotice() {
  const { workspace } = useApp();
  const { lang, t } = useI18n();
  const center = useDuplicateCenter();
  if (center.hidden || !center.groups.length) return null;
  const count = center.groups.length;
  const { emailCount, preview } = duplicatePreview(center.groups, lang);
  const summary = t("contacts.dupNoticeSummary", {
    count,
    emails: emailCount,
  });
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
          {t("contacts.dupReviewCountBtn", { count })}
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
          {t("contacts.dupMergeAllBtn")}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("contacts.dupDismissAria")}
          onClick={center.dismiss}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
