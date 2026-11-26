import { useI18n } from "../../i18n";
import type { MuseThreadSummary } from "../../types/muse";
import {
  formatAgentClockTime,
  formatAgentMailTime,
  parseMailAddressDisplay,
  resolveConciseAgentTitle,
} from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailListSkeleton } from "../mail/MailListSkeleton";

export function MuseThreadListPane({
  accountName,
  verifiedEmail,
  lastRefreshedAt,
  threads,
  selectedThreadId,
  listLoading,
  loadingMore,
  refreshing,
  hasMore,
  compact,
  onRefreshOrCancel,
  onDisconnect,
  onSelectThread,
  onLoadMore,
}: {
  accountName: string;
  verifiedEmail: string;
  lastRefreshedAt: number;
  threads: MuseThreadSummary[];
  selectedThreadId: string;
  listLoading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  compact: boolean;
  onRefreshOrCancel: () => void;
  onDisconnect: () => void;
  onSelectThread: (id: string) => void;
  onLoadMore: () => void;
}) {
  const { lang, t } = useI18n();
  const title = resolveConciseAgentTitle(accountName, "muse");
  const subtitle = verifiedEmail
    ? t("muse.listSubtitle", { email: verifiedEmail, count: threads.length })
    : t("muse.threadCountLabel", { count: threads.length });
  const syncClock = formatAgentClockTime(lastRefreshedAt, false);
  const refreshLabel = refreshing
    ? t("muse.cancelRefreshBtn")
    : t("muse.manualRefreshBtn");

  return (
    <section
      className="panel-card mail-list-pane muse-list-pane"
      aria-label={title}
    >
      <div className="list-header">
        <div className="list-title-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <h1 className="list-title truncate">{title}</h1>
              <span className="pill pill-neutral">
                {t("muse.readOnlyModeBadge")}
              </span>
            </div>
            <p className="list-subtitle truncate">{subtitle}</p>
          </div>

          <div className="row" style={{ gap: 5, flexShrink: 0 }}>
            <Tooltip label={refreshLabel}>
              <button
                type="button"
                className={`icon-btn icon-btn-bordered list-head-icon-btn${refreshing ? " is-spinning" : ""}`}
                onClick={onRefreshOrCancel}
                aria-label={refreshLabel}
              >
                <Icon name="refresh" size={13} />
              </button>
            </Tooltip>
            <Tooltip label={t("muse.disconnectBtn")}>
              <button
                type="button"
                className="icon-btn icon-btn-bordered list-head-icon-btn"
                onClick={onDisconnect}
                aria-label={t("muse.disconnectBtn")}
              >
                <Icon name="x" size={13} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div
          className="list-refresh-bar"
          data-active={refreshing}
          aria-hidden="true"
        >
          <span className="list-refresh-bar-fill" />
        </div>
      </div>

      <FadeScroll className="mail-list-scroll muse-list-scroll" label={title}>
        {listLoading && threads.length === 0 ? (
          <MailListSkeleton compact={compact} />
        ) : (
          <>
            <div className="list-group-head">
              <span className="truncate">
                {syncClock
                  ? t("muse.listGroupSyncedAt", { time: syncClock })
                  : t("muse.listGroupRecent")}
              </span>
              <span className="list-group-range">
                1–{threads.length} / {threads.length}
              </span>
            </div>

            {threads.map((item) => {
              const selected = item.id === selectedThreadId;
              const rawSender =
                item.lastFromName ||
                item.lastFrom ||
                item.participants[0] ||
                "";
              const parsed = parseMailAddressDisplay(rawSender);
              const sender =
                parsed.name || parsed.email || t("muse.unknownSenderFallback");
              const timeStr =
                item.timeKnown && item.createdAtMs > 0
                  ? formatAgentMailTime(
                      new Date(item.createdAtMs).toISOString(),
                      lang,
                      "list",
                    )
                  : t("muse.timeUnknown");

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
                      <span className="truncate">{sender}</span>
                    </div>
                    <span className="mail-card-time">{timeStr}</span>
                  </div>

                  <div className="mail-card-subject truncate">
                    {item.subject || t("muse.noSubjectFallback")}
                  </div>

                  {!compact && item.preview && (
                    <div className="mail-card-snippet wb-card-snippet">
                      {item.preview}
                    </div>
                  )}

                  <div className="mail-card-bottom">
                    <span className="source-tag truncate" data-provider="muse">
                      Muse
                    </span>
                    <span className="pill mail-meta-pill pill-neutral">
                      {t("muse.messageCountBadge", {
                        count: item.messageCount,
                      })}
                    </span>
                  </div>
                </button>
              );
            })}

            {hasMore && (
              <button
                type="button"
                className="btn btn-secondary btn-sm wb-load-more-btn"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore ? t("muse.loadingMoreBtn") : t("muse.loadMoreBtn")}
              </button>
            )}
          </>
        )}
      </FadeScroll>
    </section>
  );
}
