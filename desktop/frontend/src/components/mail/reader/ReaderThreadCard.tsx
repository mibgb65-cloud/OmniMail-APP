import { useState } from "react";
import { parseMailtoUrl } from "../../../state/storageHelpers";
import { useApp } from "../../../state/AppContext";
import type { MailItem, ThreadMessage } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import { SafeMailHtmlView } from "./SafeMailHtmlView";

export function ReaderThreadCard({
  mail,
  msg,
  isLatest,
  isExpanded,
  onExpand,
}: {
  mail: MailItem;
  msg: ThreadMessage;
  isLatest: boolean;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const { mailStore, composeStore } = useApp();
  const [showDetailHeaders, setShowDetailHeaders] = useState(false);

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
              className="icon-btn"
              style={{
                width: 26,
                height: 26,
                color: mail.starred ? "#d97706" : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                mailStore.toggleStar([mail.id]);
              }}
              aria-label={mail.starred ? "取消星标" : "标记星标"}
            >
              <Icon name="star" size={15} filled={mail.starred} />
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
              onMailto={(url) => {
                const p = parseMailtoUrl(url);
                composeStore.openNewCompose(p.to);
                if (p.subject || p.body) {
                  composeStore.updateDraft({
                    ...(p.subject ? { subject: p.subject } : {}),
                    ...(p.body ? { body: p.body } : {}),
                  });
                }
              }}
            />
          ) : (
            msg.bodyParagraphs.map((para, pIdx) => <p key={pIdx}>{para}</p>)
          )}
        </div>
      )}
    </article>
  );
}
