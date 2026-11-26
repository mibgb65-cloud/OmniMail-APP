import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type {
  WorkBuddyAttachmentMeta,
  WorkBuddyMessageDetail,
} from "../../types/workbuddy";
import {
  formatAgentMailTime,
  parseMailAddressDisplay,
} from "../../utils/agentMailFormat";
import { SafeMailHtmlView } from "../mail/reader/SafeMailHtmlView";
import { useReaderLinkHandlers } from "../mail/reader/useReaderLinkHandlers";
import { WorkBuddyAttachmentList } from "./WorkBuddyReaderExtras";

export function WorkBuddyThreadCard({
  detail,
  savingAttachmentId,
  onSaveAttachment,
}: {
  detail: WorkBuddyMessageDetail;
  savingAttachmentId: string;
  onSaveAttachment: (att: WorkBuddyAttachmentMeta) => void;
}) {
  const { workspace } = useApp();
  const { lang, t } = useI18n();
  const { onMailto, onExternalLink } = useReaderLinkHandlers(false);

  const senderParsed = parseMailAddressDisplay(detail.from);
  const senderName = senderParsed.name || senderParsed.email || "—";
  const avatarChar = (senderName.slice(0, 1) || "W").toUpperCase();

  return (
    <article className="thread-card wb-thread-card">
      <div className="thread-card-head wb-thread-head">
        <div className="wb-thread-head-left">
          <div className="avatar-circle wb-avatar">{avatarChar}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <strong className="wb-sender-name truncate">{senderName}</strong>
              {senderParsed.email && (
                <span className="wb-sender-email truncate">
                  &lt;{senderParsed.email}&gt;
                </span>
              )}
            </div>
            <div className="wb-recipient-line truncate">
              {t("reader.recipientsPrefix", {
                to: detail.to.join(", ") || "—",
              })}{" "}
              · {t("workbuddy.fromWorkBuddySuffix")}
            </div>
            {detail.cc.length > 0 && (
              <div className="wb-recipient-line truncate">
                {t("reader.ccPrefix", { cc: detail.cc.join(", ") })}
              </div>
            )}
          </div>
        </div>
        <span className="wb-detail-time">
          {formatAgentMailTime(detail.createdAt, lang, "detail")}
        </span>
      </div>

      <div className="thread-body wb-thread-body">
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
        <WorkBuddyAttachmentList
          attachments={detail.attachments}
          savingAttachmentId={savingAttachmentId}
          onSaveAttachment={onSaveAttachment}
        />
      </div>
    </article>
  );
}
