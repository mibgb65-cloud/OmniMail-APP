import { useCallback, useState } from "react";
import { useI18n } from "../../../i18n";
import { parseMailtoUrl } from "../../../state/storageHelpers";
import { useApp } from "../../../state/AppContext";
import type { MailItem, ThreadMessage } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import {
  translatedSegment,
  type BodyTranslation,
} from "../translation/translatedText";
import { SafeMailHtmlView } from "./SafeMailHtmlView";

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
const emailMetaStyle = { fontSize: 12, color: "var(--text-muted)" };
const toMetaStyle = { fontSize: 12, color: "var(--text-secondary)" };
const detailBtnStyle = {
  color: "var(--brand-accent)",
  fontSize: 12,
  flexShrink: 0,
};
const timeTextStyle = { fontSize: 12, color: "var(--text-muted)" };

export function ReaderThreadCard({
  mail,
  msg,
  isLatest,
  isExpanded,
  onExpand,
  translation,
}: {
  mail: MailItem;
  msg: ThreadMessage;
  isLatest: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  translation?: BodyTranslation;
}) {
  const { t, formatTime, localizeText } = useI18n();
  const { mailStore, composeStore } = useApp();
  const [showDetailHeaders, setShowDetailHeaders] = useState(false);
  const { openNewCompose, updateDraft } = composeStore;
  const onMailto = useCallback(
    (url: string) => {
      const p = parseMailtoUrl(url);
      openNewCompose(p.to);
      if (p.subject || p.body)
        updateDraft({
          ...(p.subject ? { subject: p.subject } : {}),
          ...(p.body ? { body: p.body } : {}),
        });
    },
    [openNewCompose, updateDraft],
  );
  const paragraphs =
    msg.bodyParagraphs.length > 0
      ? msg.bodyParagraphs
      : [t("common.emptyMailBody")];
  const toLine = t("reader.recipientsPrefix", { to: msg.recipients });
  const detailLabel = t(
    showDetailHeaders ? "reader.hideDetails" : "reader.showDetails",
  );
  const starAria = t(mail.starred ? "reader.unstarAria" : "reader.starAria");

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
              <span className="truncate" style={emailMetaStyle}>
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
                  {detailLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={headRightStyle}>
          <span style={{ ...timeTextStyle, whiteSpace: "nowrap" }}>
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
              aria-label={starAria}
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
              translation={translation}
              onMailto={onMailto}
            />
          ) : (
            paragraphs.map((para, pIdx) => {
              const text =
                translation && translatedSegment(para, translation.segments);
              const displayPara = localizeText(para);
              return (
                <p key={pIdx}>
                  {translation?.mode === "translated" && text
                    ? text
                    : displayPara}
                  {translation?.mode === "bilingual" && text && (
                    <span
                      className="reader-translated-paragraph"
                      lang={translation.target}
                    >
                      {text}
                    </span>
                  )}
                </p>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}
