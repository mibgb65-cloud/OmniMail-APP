import { useI18n } from "../../i18n";
import type {
  WorkBuddyDirection,
  WorkBuddyMessageSummary,
} from "../../types/workbuddy";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailListSkeleton } from "../mail/MailListSkeleton";

export interface WorkBuddyListPaneProps {
  dir: WorkBuddyDirection;
  searchQuery: string;
  messages: WorkBuddyMessageSummary[];
  selectedMessageId: string;
  listLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  compact: boolean;
  onSelectMessage: (id: string) => void;
  onLoadMore: () => void;
}

export function WorkBuddyListPane({
  dir,
  searchQuery,
  messages,
  selectedMessageId,
  listLoading,
  loadingMore,
  hasMore,
  compact,
  onSelectMessage,
  onLoadMore,
}: WorkBuddyListPaneProps) {
  const { t, formatTime } = useI18n();
  const hasSearch = Boolean(searchQuery.trim());

  const emptyTitle = hasSearch
    ? t("workbuddy.emptySearchTitle")
    : dir === "sent"
      ? t("workbuddy.emptySentTitle")
      : t("workbuddy.emptyInboxTitle");

  return (
    <section
      className="panel-card wb-list-pane"
      aria-label={t("workbuddy.providerName")}
    >
      <div className="wb-list-head">
        <strong className="wb-list-title">
          {dir === "sent" ? t("workbuddy.sentTab") : t("workbuddy.inboxTab")}
        </strong>
        <span className="text-xs text-muted">
          {t("workbuddy.listCountLabel", { count: messages.length })}
        </span>
      </div>

      <FadeScroll
        key={`${dir}:${hasSearch ? searchQuery.trim() : "all"}`}
        className="wb-list-scroll"
        label={t("workbuddy.providerName")}
      >
        {listLoading && messages.length === 0 ? (
          <MailListSkeleton compact={compact} />
        ) : messages.length === 0 ? (
          <div className="wb-empty-box">
            <span className="wb-empty-icon" aria-hidden="true">
              <Icon name="inbox" size={20} />
            </span>
            <strong className="wb-empty-title">{emptyTitle}</strong>
            <p className="wb-empty-desc">{t("workbuddy.emptyListDesc")}</p>
          </div>
        ) : (
          <div className="wb-msg-items">
            {messages.map((item) => {
              const selected = item.messageId === selectedMessageId;
              const peer =
                dir === "sent"
                  ? item.to.join(", ") || item.from
                  : item.from || item.to[0] || "—";
              return (
                <button
                  key={item.messageId}
                  type="button"
                  className={`mail-card wb-msg-card ${selected ? "selected" : ""} ${!item.isRead ? "unread" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSelectMessage(item.messageId)}
                >
                  <div className="mail-card-top">
                    <div className="mail-card-sender">
                      {!item.isRead && (
                        <span
                          className="wb-unread-dot"
                          aria-label={t("workbuddy.unreadDotAria")}
                        />
                      )}
                      <span className="truncate">{peer || "—"}</span>
                    </div>
                    <span className="mail-card-time">
                      {item.createdAt ? formatTime(item.createdAt) : ""}
                    </span>
                  </div>

                  <div className="mail-card-subject truncate">
                    {item.subject || t("workbuddy.noSubject")}
                  </div>

                  {!compact && item.snippet && (
                    <div className="mail-card-snippet">{item.snippet}</div>
                  )}

                  {item.hasAttachments && (
                    <div className="mail-card-bottom">
                      <span className="wb-att-chip">
                        <Icon name="paperclip" size={11} />
                        <span>{t("workbuddy.downloadAttachmentBtn")}</span>
                      </span>
                    </div>
                  )}
                </button>
              );
            })}

            {hasMore && (
              <div className="wb-load-more-wrap">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm wb-load-more-btn"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                >
                  {loadingMore
                    ? t("workbuddy.loadingMoreBtn")
                    : t("workbuddy.loadMoreBtn")}
                </button>
              </div>
            )}
          </div>
        )}
      </FadeScroll>
    </section>
  );
}
