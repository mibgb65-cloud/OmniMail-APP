import { useI18n } from "../../i18n";
import type { WorkBuddyAttachmentMeta } from "../../types/workbuddy";
import { formatAgentClockTime } from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function WorkBuddyReaderToolbar({
  isRead,
  loading,
  firstAttachment,
  savingAttachmentId,
  currentIndex,
  totalCount,
  onMarkRead,
  onCopySender,
  onRefreshBody,
  onSaveAttachment,
  onRequestDelete,
  onNavigate,
}: {
  isRead: boolean;
  loading: boolean;
  firstAttachment?: WorkBuddyAttachmentMeta;
  savingAttachmentId: string;
  currentIndex: number;
  totalCount: number;
  onMarkRead: () => void;
  onCopySender: () => void;
  onRefreshBody: () => void;
  onSaveAttachment: (att: WorkBuddyAttachmentMeta) => void;
  onRequestDelete: () => void;
  onNavigate: (delta: -1 | 1) => void;
}) {
  const { t } = useI18n();
  const navText = `${currentIndex + 1} / ${Math.max(1, totalCount)}`;

  return (
    <div className="reader-toolbar wb-reader-toolbar">
      <div className="wb-toolbar-left">
        <button
          type="button"
          className={`btn btn-sm btn-secondary wb-read-pill-btn ${isRead ? "is-read" : ""}`}
          disabled={isRead}
          onClick={onMarkRead}
        >
          <Icon name="check" size={13} />
          <span>
            {isRead
              ? t("workbuddy.alreadyReadLabel")
              : t("workbuddy.markReadBtn")}
          </span>
        </button>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={onCopySender}
        >
          <span>{t("workbuddy.copySenderBtn")}</span>
        </button>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={loading}
          onClick={onRefreshBody}
        >
          <span>{t("workbuddy.refreshBodyBtn")}</span>
        </button>

        {firstAttachment && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={Boolean(savingAttachmentId)}
            onClick={() => onSaveAttachment(firstAttachment)}
          >
            <Icon name="download" size={13} />
            <span>{t("workbuddy.downloadAttachmentBtn")}</span>
          </button>
        )}

        <span className="wb-toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className="btn btn-sm wb-delete-soft-btn"
          onClick={onRequestDelete}
        >
          <Icon name="trash" size={13} />
          <span>{t("workbuddy.deleteBtn")}</span>
        </button>
      </div>

      <div className="wb-toolbar-nav">
        <span className="wb-nav-count">{navText}</span>
        <Tooltip label={t("reader.prevMailTip")}>
          <button
            type="button"
            className="icon-btn icon-btn-bordered wb-nav-icon-btn"
            disabled={currentIndex <= 0}
            aria-label={t("reader.prevMailTip")}
            onClick={() => onNavigate(-1)}
          >
            <Icon name="chevronLeft" size={13} />
          </button>
        </Tooltip>
        <Tooltip label={t("reader.nextMailTip")}>
          <button
            type="button"
            className="icon-btn icon-btn-bordered wb-nav-icon-btn"
            disabled={currentIndex >= totalCount - 1}
            aria-label={t("reader.nextMailTip")}
            onClick={() => onNavigate(1)}
          >
            <Icon name="chevronRight" size={13} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export function WorkBuddyReaderFooter({
  lastSyncedAt,
  canCopyMailbox,
  canReply,
  onCopyMailbox,
  onReplyViaRegular,
}: {
  lastSyncedAt: number;
  canCopyMailbox: boolean;
  canReply: boolean;
  onCopyMailbox: () => void;
  onReplyViaRegular: () => void;
}) {
  const { t } = useI18n();
  const syncedClock = formatAgentClockTime(lastSyncedAt, true);

  return (
    <footer className="wb-reader-footer">
      <div className="wb-footer-status">
        <span className="wb-footer-dot" aria-hidden="true" />
        <span className="truncate">
          {syncedClock
            ? t("workbuddy.footerSyncedStatus", { time: syncedClock })
            : t("workbuddy.footerIdleStatus")}
        </span>
      </div>
      <div className="wb-footer-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canCopyMailbox}
          onClick={onCopyMailbox}
        >
          {t("workbuddy.copyMailboxBtn")}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!canReply}
          onClick={onReplyViaRegular}
        >
          {t("workbuddy.replyViaRegularBtn")}
        </button>
      </div>
    </footer>
  );
}
