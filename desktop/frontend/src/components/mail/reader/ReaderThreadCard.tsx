import { useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem, ThreadMessage } from "../../../types/mail";
import type { DarkHtmlMode, ThemeMode } from "../../../types/settings";
import { Icon } from "../../common/Icon";
import type { BodyTranslation } from "../translation/translatedText";
import { PlainTextBody } from "./PlainTextParagraph";
import { SafeMailHtmlView } from "./SafeMailHtmlView";
import {
  useReaderImageHandlers,
  useReaderLinkHandlers,
} from "./useReaderLinkHandlers";

const headLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  flex: 1,
};
const headRightStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};
const mutedMetaStyle = { fontSize: 12, color: "var(--text-muted)" };
const toMetaStyle = { fontSize: 12, color: "var(--text-secondary)" };
const detailBtnStyle = {
  color: "var(--brand-accent)",
  fontSize: 12,
  flexShrink: 0,
};

interface ReaderThreadCardProps {
  mail: MailItem;
  msg: ThreadMessage;
  theme: ThemeMode;
  htmlThemeMode: DarkHtmlMode;
  isLatest: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  translation?: BodyTranslation;
}

export function ReaderThreadCard({
  mail,
  msg,
  theme,
  htmlThemeMode,
  isLatest,
  isExpanded,
  onExpand,
  translation,
}: ReaderThreadCardProps) {
  const { t, formatTime, localizeText } = useI18n();
  const { mailStore } = useApp();
  const [showDetailHeaders, setShowDetailHeaders] = useState(false);
  const { onMailto, onExternalLink } = useReaderLinkHandlers(
    mail.securityWarning?.level === "danger",
  );
  const { onOpenImage, onRetryInlineCid } = useReaderImageHandlers(
    mail.attachments,
  );
  const paragraphs =
    msg.bodyParagraphs.length > 0
      ? msg.bodyParagraphs
      : [t("common.emptyMailBody")];
  const toLine = t("reader.recipientsPrefix", { to: msg.recipients });

  return (
    <article
      className={`thread-card ${isExpanded ? "" : "collapsed"}`}
      onClick={() => !isExpanded && onExpand()}
    >
      <div className="thread-card-head">
        <div style={headLeftStyle}>
          <div className="avatar-circle" data-tone={mail.avatarTone}>
            {msg.senderName.slice(0, 1)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <strong
                className="truncate"
                style={{ fontSize: 13, color: "var(--text-ink)" }}
              >
                {msg.senderName}
              </strong>
              <span className="truncate" style={mutedMetaStyle}>
                &lt;{msg.senderEmail}&gt;
              </span>
            </div>
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <span className="truncate" style={toMetaStyle}>
                {toLine}
              </span>
              {isLatest && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailHeaders((v) => !v);
                  }}
                  style={detailBtnStyle}
                >
                  {t(
                    showDetailHeaders
                      ? "reader.hideDetails"
                      : "reader.showDetails",
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={headRightStyle}>
          <span style={{ ...mutedMetaStyle, whiteSpace: "nowrap" }}>
            {formatTime(msg.timeText)}
          </span>
          {isLatest && (
            <button
              type="button"
              className="icon-btn thread-star-btn"
              aria-pressed={mail.starred}
              onClick={(e) => {
                e.stopPropagation();
                mailStore.toggleStar([mail.id]);
              }}
              aria-label={t(
                mail.starred ? "reader.unstarAria" : "reader.starAria",
              )}
            >
              <Icon name="star" size={15} />
            </button>
          )}
        </div>
      </div>

      {isLatest && showDetailHeaders && (
        <div className="thread-detail-headers">
          <div className="truncate">
            {t("reader.senderPrefix", {
              name: msg.senderName,
              email: msg.senderEmail,
            })}
          </div>
          <div className="truncate">{toLine}</div>
          {msg.cc && (
            <div className="truncate">
              {t("reader.ccPrefix", { cc: msg.cc })}
            </div>
          )}
          <div className="truncate">{t("reader.tlsVerifiedRow")}</div>
        </div>
      )}

      {isExpanded && (
        <div className="thread-body">
          {msg.bodyHtml ? (
            <SafeMailHtmlView
              html={msg.bodyHtml}
              theme={theme}
              htmlThemeMode={htmlThemeMode}
              translation={translation}
              onMailto={onMailto}
              onExternalLink={onExternalLink}
              onOpenImage={onOpenImage}
              onRetryInlineCid={onRetryInlineCid}
            />
          ) : (
            <PlainTextBody
              paragraphs={paragraphs}
              localizeText={localizeText}
              translation={translation}
              onExternalLink={onExternalLink}
              onMailto={onMailto}
            />
          )}
        </div>
      )}
    </article>
  );
}
