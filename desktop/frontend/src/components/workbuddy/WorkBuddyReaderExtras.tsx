import { useI18n } from "../../i18n";
import type { PendingDeleteTarget } from "../../state/workBuddyStoreActions";
import type { WorkBuddyAttachmentMeta } from "../../types/workbuddy";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

function formatByteSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function WorkBuddyAttachmentList({
  attachments,
  savingAttachmentId,
  onSaveAttachment,
}: {
  attachments: WorkBuddyAttachmentMeta[];
  savingAttachmentId: string;
  onSaveAttachment: (att: WorkBuddyAttachmentMeta) => void;
}) {
  const { t } = useI18n();
  if (attachments.length === 0) return null;

  return (
    <div className="wb-attachments-card">
      <div className="wb-attachments-title">
        <Icon name="paperclip" size={13} />
        <span>
          {t("workbuddy.attachmentsHeading", { count: attachments.length })}
        </span>
      </div>
      <div className="wb-attachment-list">
        {attachments.map((att) => (
          <button
            key={att.attachmentId}
            type="button"
            className="wb-attachment-item"
            disabled={savingAttachmentId === att.attachmentId}
            onClick={() => onSaveAttachment(att)}
          >
            <div className="wb-attachment-meta">
              <Icon name="file" size={14} />
              <span className="wb-attachment-name truncate">
                {att.filename}
              </span>
              <span className="wb-attachment-size">
                ({formatByteSize(att.size)})
              </span>
            </div>
            <span className="wb-attachment-save">
              <Icon name="download" size={12} />
              <span>{t("workbuddy.saveAttachmentItemBtn")}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkBuddyDeleteModal({
  target,
  deleting,
  onCancel,
  onConfirm,
}: {
  target: PendingDeleteTarget | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  if (!target) return null;

  return (
    <ModalShell
      heading={t("workbuddy.deleteModalTitle")}
      maxWidth={440}
      onClose={() => {
        if (!deleting) onCancel();
      }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={deleting}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting || target.preparing}
            onClick={onConfirm}
          >
            <Icon name="trash" size={14} />
            <span>
              {deleting || target.preparing
                ? t("workbuddy.deletingBtn")
                : t("workbuddy.confirmDeleteBtn")}
            </span>
          </button>
        </>
      }
    >
      <p className="wb-delete-modal-desc">
        {t("workbuddy.deleteModalDesc", {
          subject: target.subject || t("workbuddy.noSubject"),
        })}
      </p>
    </ModalShell>
  );
}
