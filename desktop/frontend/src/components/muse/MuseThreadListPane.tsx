import { useI18n } from "../../i18n";
import type { MuseThreadSummary } from "../../types/muse";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailListSkeleton } from "../mail/MailListSkeleton";

function formatThreadTime(
  ms: number,
  known: boolean,
  lang: string,
  unknownText: string,
): string {
  if (!known || !ms || ms <= 0) return unknownText;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return unknownText;
  return new Intl.DateTimeFormat(lang === "en-US" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function MuseThreadListPane({
  threads,
  selectedThreadId,
  listLoading,
  loadingMore,
  hasMore,
  compact,
  onSelectThread,
  onLoadMore,
}: {
  threads: MuseThreadSummary[];
  selectedThreadId: string;
  listLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  compact: boolean;
  onSelectThread: (id: string) => void;
  onLoadMore: () => void;
}) {
  const { lang, t } = useI18n();

  return (
    <section
      className="panel-card mail-list-pane muse-list-pane"
      aria-label={t("muse.threadListHeading")}
    >
      <div className="muse-list-head">
        <strong className="muse-list-title">
          {t("muse.threadListHeading")}
        </strong>
        <span className="text-xs text-muted">
          {t("muse.threadCountLabel", { count: threads.length })}
        </span>
      </div>

      <FadeScroll
        className="muse-list-scroll"
        label={t("muse.threadListHeading")}
      >
        {listLoading && threads.length === 0 ? (
          <MailListSkeleton compact={compact} />
        ) : (
          <div className="muse-thread-items">
            {threads.map((item) => {
              const selected = item.id === selectedThreadId;
              const sender =
                item.lastFromName ||
                item.lastFrom ||
                item.participants[0] ||
                t("muse.unknownSenderFallback");
              const timeStr = formatThreadTime(
                item.createdAtMs,
                item.timeKnown,
                lang,
                t("muse.timeUnknown"),
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mail-card muse-thread-card ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSelectThread(item.id)}
                >
                  <div className="mail-card-top">
                    <div className="mail-card-sender">
                      <span className="truncate" style={{ fontWeight: 600 }}>
                        {sender}
                      </span>
                    </div>
                    <span className="mail-card-time">{timeStr}</span>
                  </div>

                  <div className="mail-card-subject truncate">
                    {item.subject || t("muse.noSubjectFallback")}
                  </div>

                  {!compact && item.preview && (
                    <div className="mail-card-snippet truncate">
                      {item.preview}
                    </div>
                  )}

                  <div className="mail-card-bottom">
                    <span className="pill pill-neutral">
                      {t("muse.messageCountBadge", {
                        count: item.messageCount,
                      })}
                    </span>
                    {item.participants.length > 0 && (
                      <span className="text-xs text-muted truncate">
                        {item.participants.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {hasMore && (
              <div className="muse-load-more-wrap">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm muse-load-more-btn"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                >
                  {loadingMore
                    ? t("muse.loadingMoreBtn")
                    : t("muse.loadMoreBtn")}
                </button>
              </div>
            )}
          </div>
        )}
      </FadeScroll>
    </section>
  );
}
