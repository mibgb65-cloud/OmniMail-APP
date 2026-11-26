import { useI18n } from "../../i18n";
import {
  formatMuseByteSize,
  splitMuseBodyParagraphs,
  type MuseMessage,
} from "../../types/muse";
import {
  formatAgentMailTime,
  parseMailAddressDisplay,
} from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";
import { PlainTextBody } from "../mail/reader/PlainTextParagraph";
import { useReaderLinkHandlers } from "../mail/reader/useReaderLinkHandlers";

export function MuseMessageCard({ msg }: { msg: MuseMessage }) {
  const { lang, t, localizeText } = useI18n();
  const { onExternalLink, onMailto } = useReaderLinkHandlers(false);
  const paragraphs = splitMuseBodyParagraphs(msg.bodyText);

  const parsed = parseMailAddressDisplay(
    msg.fromName && msg.from
      ? `${msg.fromName} <${msg.from}>`
      : msg.from || msg.fromName,
  );
  const senderName =
    parsed.name || parsed.email || t("muse.unknownSenderFallback");
  const avatarChar = (senderName.slice(0, 1) || "M").toUpperCase();

  const dirLabel =
    msg.direction === "outbound"
      ? t("muse.directionOutbound")
      : msg.direction === "inbound"
        ? t("muse.directionInbound")
        : t("muse.directionUnknown");
  const dirClass =
    msg.direction === "outbound"
      ? "pill pill-accent"
      : msg.direction === "inbound"
        ? "pill pill-neutral"
        : "pill pill-warning";
  const timeStr =
    msg.timeKnown && msg.createdAtMs > 0
      ? formatAgentMailTime(
          new Date(msg.createdAtMs).toISOString(),
          lang,
          "detail",
        )
      : t("muse.timeUnknown");

  return (
    <article className="thread-card wb-thread-card">
      <header className="thread-card-head wb-thread-head">
        <div className="wb-thread-head-left">
          <div className="avatar-circle muse-avatar">{avatarChar}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <strong className="wb-sender-name truncate">{senderName}</strong>
              {parsed.email && (
                <span className="wb-sender-email truncate">
                  &lt;{parsed.email}&gt;
                </span>
              )}
              <span className={dirClass}>{dirLabel}</span>
              {msg.museAuthVerdict && (
                <span className="muse-verdict-chip">
                  {t("muse.museVerdictBadge", { verdict: msg.museAuthVerdict })}
                </span>
              )}
            </div>
            {msg.to.length > 0 && (
              <div className="wb-recipient-line truncate">
                {t("muse.toLabel")}：{msg.to.join(", ")}
                {msg.cc.length > 0
                  ? ` · ${t("muse.ccLabel")}：${msg.cc.join(", ")}`
                  : ""}
              </div>
            )}
          </div>
        </div>
        <span className="wb-detail-time">{timeStr}</span>
      </header>

      <div className="thread-body wb-thread-body muse-msg-body">
        {paragraphs.length > 0 ? (
          <PlainTextBody
            paragraphs={paragraphs}
            localizeText={localizeText}
            onExternalLink={onExternalLink}
            onMailto={onMailto}
          />
        ) : (
          <p className="text-muted">{t("muse.emptyBodyPlaceholder")}</p>
        )}

        {msg.attachments.length > 0 && (
          <div className="muse-att-section">
            <div className="muse-att-label">
              {t("muse.attachmentsMetaLabel")}
            </div>
            <div className="muse-att-list">
              {msg.attachments.map((att) => (
                <span
                  key={`${att.index}-${att.filename}`}
                  className="muse-att-chip"
                >
                  <Icon name="paperclip" size={13} />
                  <span className="truncate">{att.filename}</span>
                  {att.size > 0 && (
                    <span className="text-muted">
                      · {formatMuseByteSize(att.size)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
