import { useCallback, useState } from "react";
import { parseMailtoUrl } from "../../../state/storageHelpers";
import { useApp } from "../../../state/AppContext";
import type { MailItem, ThreadMessage } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import {
  translatedSegment,
  type BodyTranslation,
} from "../translation/translatedText";
import { SafeMailHtmlView } from "./SafeMailHtmlView";

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

  return (
    <article
      className={`thread-card ${isExpanded ? "" : "collapsed"}`}
      onClick={() => {
        if (!isExpanded) onExpand();
      }}
    >
      <div className="thread-card-head">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            flex: 1,
          }}
        >
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
              <span
                className="truncate"
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  minWidth: 0,
                }}
              >
                &lt;{msg.senderEmail}&gt;
              </span>
            </div>
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <span
                className="truncate"
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  minWidth: 0,
                }}
              >
                收件人：{msg.recipients}
              </span>
              {isLatest && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailHeaders((v) => !v);
                  }}
                  style={{
                    color: "var(--brand-accent)",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {showDetailHeaders ? "收起详情" : "详情"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {msg.timeText}
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
              aria-label={mail.starred ? "取消星标" : "标记星标"}
            >
              <Icon name="star" size={15} />
            </button>
          )}
        </div>
      </div>

      {isLatest && showDetailHeaders && (
        <div className="thread-detail-headers">
          <div className="truncate">
            发件人：{msg.senderName} &lt;{msg.senderEmail}&gt;
          </div>
          <div className="truncate">收件人：{msg.recipients}</div>
          {msg.cc && <div className="truncate">抄送 Cc：{msg.cc}</div>}
          <div className="truncate">
            加密与验证：TLS 1.3 · SPF PASS · DKIM PASS · DMARC PASS
          </div>
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
            msg.bodyParagraphs.map((para, pIdx) => {
              const text =
                translation && translatedSegment(para, translation.segments);
              return (
                <p key={pIdx}>
                  {translation?.mode === "translated" && text ? text : para}
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
