import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type {
  WorkBuddyAttachmentMeta,
  WorkBuddyMessageDetail,
} from "../../types/workbuddy";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { SafeMailHtmlView } from "../mail/reader/SafeMailHtmlView";
import { useReaderLinkHandlers } from "../mail/reader/useReaderLinkHandlers";
import { WorkBuddyAttachmentList } from "./WorkBuddyReaderExtras";

export interface WorkBuddyReaderPaneProps {
  detail: WorkBuddyMessageDetail | null;
  loading: boolean;
  savingAttachmentId: string;
  onMarkRead: () => void;
  onSaveAttachment: (att: WorkBuddyAttachmentMeta) => void;
  onRequestDelete: (messageId: string, subject: string) => void;
}

export function WorkBuddyReaderPane({
  detail,
  loading,
  savingAttachmentId,
  onMarkRead,
  onSaveAttachment,
  onRequestDelete,
}: WorkBuddyReaderPaneProps) {
  const { workspace } = useApp();
  const { t, formatTime } = useI18n();
  const { onMailto, onExternalLink } = useReaderLinkHandlers(false);

  if (loading && !detail) {
    return (
      <section className="panel-card wb-reader-pane">
        <div className="wb-reader-skeleton" aria-busy="true">
          <span
            className="omni-shimmer-bar"
            style={{ width: "56%", height: 20 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "38%", height: 13 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "92%", height: 120 }}
          />
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="panel-card wb-reader-pane">
        <div className="wb-empty-box wb-reader-empty">
          <span className="wb-empty-icon" aria-hidden="true">
            <Icon name="mail" size={20} />
          </span>
          <strong className="wb-empty-title">
            {t("workbuddy.selectMessageTitle")}
          </strong>
          <p className="wb-empty-desc">{t("workbuddy.selectMessageDesc")}</p>
        </div>
      </section>
    );
  }

  const subjectText = detail.subject || t("workbuddy.noSubject");
  const firstAtt = detail.attachments[0];

  return (
    <section className="panel-card wb-reader-pane">
      <div className="wb-reader-toolbar">
        <div className="wb-reader-toolbar-left">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={detail.isRead}
            onClick={onMarkRead}
          >
            <Icon name="check" size={13} />
            <span>
              {detail.isRead
                ? t("workbuddy.alreadyReadLabel")
                : t("workbuddy.markReadBtn")}
            </span>
          </button>

          {firstAtt && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={Boolean(savingAttachmentId)}
              onClick={() => onSaveAttachment(firstAtt)}
            >
              <Icon name="download" size={13} />
              <span>{t("workbuddy.downloadAttachmentBtn")}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm wb-delete-action-btn"
          onClick={() => onRequestDelete(detail.messageId, subjectText)}
        >
          <Icon name="trash" size={13} />
          <span>{t("workbuddy.deleteBtn")}</span>
        </button>
      </div>

      <FadeScroll
        key={detail.messageId}
        className="wb-reader-scroll"
        label={subjectText}
      >
        <header className="wb-detail-head">
          <h2 className="wb-detail-subject">{subjectText}</h2>
          <div className="wb-detail-meta">
            <div className="wb-detail-meta-row">
              <span className="wb-meta-key">{t("workbuddy.senderLabel")}</span>
              <span className="wb-meta-val">{detail.from || "—"}</span>
              {detail.createdAt && (
                <span className="wb-meta-time">
                  {formatTime(detail.createdAt)}
                </span>
              )}
            </div>
            {detail.to.length > 0 && (
              <div className="wb-detail-meta-row">
                <span className="wb-meta-key">
                  {t("workbuddy.recipientsLabel")}
                </span>
                <span className="wb-meta-val">{detail.to.join(", ")}</span>
              </div>
            )}
            {detail.cc.length > 0 && (
              <div className="wb-detail-meta-row">
                <span className="wb-meta-key">{t("workbuddy.ccLabel")}</span>
                <span className="wb-meta-val">{detail.cc.join(", ")}</span>
              </div>
            )}
          </div>
        </header>

        <WorkBuddyAttachmentList
          attachments={detail.attachments}
          savingAttachmentId={savingAttachmentId}
          onSaveAttachment={onSaveAttachment}
        />

        <div className="wb-detail-body">
          {detail.bodyFormat === "HTML" && detail.sanitizedHtml ? (
            <SafeMailHtmlView
              html={detail.sanitizedHtml}
              theme={workspace.settings.theme}
              htmlThemeMode={workspace.settings.darkHtmlMode}
              onMailto={onMailto}
              onExternalLink={onExternalLink}
            />
          ) : (
            <pre className="wb-plain-body">{detail.plainText}</pre>
          )}
        </div>
      </FadeScroll>
    </section>
  );
}
