import { useI18n } from "../../i18n";
import {
  formatMuseByteSize,
  splitMuseBodyParagraphs,
  type MuseMessage,
  type MuseThreadDetail,
} from "../../types/muse";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { PlainTextBody } from "../mail/reader/PlainTextParagraph";
import { useReaderLinkHandlers } from "../mail/reader/useReaderLinkHandlers";

function formatDetailTime(
  ms: number,
  known: boolean,
  lang: string,
  unknownText: string,
): string {
  if (!known || !ms || ms <= 0) return unknownText;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return unknownText;
  return new Intl.DateTimeFormat(lang === "en-US" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function MuseMessageCard({ msg }: { msg: MuseMessage }) {
  const { lang, t, localizeText } = useI18n();
  const { onExternalLink, onMailto } = useReaderLinkHandlers(false);
  const paragraphs = splitMuseBodyParagraphs(msg.bodyText);
  const senderDisplay =
    msg.fromName && msg.from
      ? `${msg.fromName} <${msg.from}>`
      : msg.from || msg.fromName || t("muse.unknownSenderFallback");
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

  return (
    <article className="muse-msg-card">
      <header className="muse-msg-head">
        <div className="muse-msg-meta-left">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className={dirClass}>{dirLabel}</span>
            <strong className="muse-msg-sender">{senderDisplay}</strong>
            {msg.museAuthVerdict && (
              <span className="muse-verdict-chip">
                {t("muse.museVerdictBadge", { verdict: msg.museAuthVerdict })}
              </span>
            )}
          </div>

          {msg.to.length > 0 && (
            <div className="text-xs text-muted truncate">
              {t("muse.toLabel")}: {msg.to.join(", ")}
              {msg.cc.length > 0
                ? ` · ${t("muse.ccLabel")}: ${msg.cc.join(", ")}`
                : ""}
            </div>
          )}
        </div>

        <span className="muse-msg-time">
          {formatDetailTime(
            msg.createdAtMs,
            msg.timeKnown,
            lang,
            t("muse.timeUnknown"),
          )}
        </span>
      </header>

      <div className="reader-body muse-msg-body">
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
      </div>

      {msg.attachments.length > 0 && (
        <div className="muse-att-section">
          <div className="muse-att-label">{t("muse.attachmentsMetaLabel")}</div>
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
    </article>
  );
}

export function MuseThreadReaderPane({
  detail,
  loading,
}: {
  detail: MuseThreadDetail | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  return (
    <section
      className="panel-card mail-reader-pane muse-reader-pane"
      aria-label={t("muse.providerName")}
    >
      {loading ? (
        <div className="muse-reader-placeholder" role="status">
          <span
            className="omni-shimmer-bar"
            style={{ width: "54%", height: 18 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "36%", height: 12 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "88%", height: 84 }}
          />
        </div>
      ) : !detail ? (
        <div className="muse-reader-empty">
          <Icon name="mail" size={26} />
          <strong>{t("muse.selectThreadHintTitle")}</strong>
          <span className="text-xs text-muted">
            {t("muse.selectThreadHintDesc")}
          </span>
        </div>
      ) : (
        <>
          <header className="muse-reader-head">
            <h2 className="muse-reader-subject">
              {detail.subject || t("muse.noSubjectFallback")}
            </h2>
            <div className="muse-reader-subnote">
              <Icon name="clock" size={13} />
              <span>{t("muse.serverTimeSemanticNote")}</span>
            </div>
          </header>

          <FadeScroll
            className="muse-reader-scroll"
            label={detail.subject || t("muse.providerName")}
          >
            <div className="muse-msg-stack">
              {detail.messages.map((msg) => (
                <MuseMessageCard key={msg.id} msg={msg} />
              ))}
            </div>
          </FadeScroll>
        </>
      )}
    </section>
  );
}
