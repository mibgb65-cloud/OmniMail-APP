import { useI18n } from "../../i18n";
import type { ParsedBackendError } from "../../services/backendClient";
import type {
  WorkBuddyAccount,
  WorkBuddyDailyQuota,
  WorkBuddyDirection,
  WorkBuddyMessageSummary,
} from "../../types/workbuddy";
import {
  formatAgentClockTime,
  resolveConciseAgentTitle,
} from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailListSkeleton } from "../mail/MailListSkeleton";
import { WorkBuddyListHeader } from "./WorkBuddyListHeader";
import { WorkBuddyMailCard } from "./WorkBuddyMailCard";

export interface WorkBuddyListPaneProps {
  account?: WorkBuddyAccount;
  dir: WorkBuddyDirection;
  searchQuery: string;
  dailyQuota: WorkBuddyDailyQuota;
  lastSyncedAt: number;
  messages: WorkBuddyMessageSummary[];
  selectedMessageId: string;
  selectedDetailFormat?: "HTML" | "TEXT";
  listLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  compact: boolean;
  activeError: ParsedBackendError | null;
  onChangeDir: (next: WorkBuddyDirection) => void;
  onChangeSearch: (next: string) => void;
  onRefresh: () => void;
  onSelectMessage: (id: string) => void;
  onLoadMore: () => void;
  onReauthorize: () => void;
}

export function WorkBuddyListPane(props: WorkBuddyListPaneProps) {
  const {
    account,
    dir,
    searchQuery,
    dailyQuota,
    lastSyncedAt,
    messages,
    selectedMessageId,
    selectedDetailFormat,
    listLoading,
    loadingMore,
    hasMore,
    compact,
    activeError,
    onChangeDir,
    onChangeSearch,
    onRefresh,
    onSelectMessage,
    onLoadMore,
    onReauthorize,
  } = props;
  const { t } = useI18n();
  const hasSearch = Boolean(searchQuery.trim());
  const title = resolveConciseAgentTitle(account?.accountName, "workbuddy");
  const subtitle = account?.email
    ? t("workbuddy.listSubtitle", {
        email: account.email,
        count: messages.length,
      })
    : t("workbuddy.listCountLabel", { count: messages.length });
  const syncClock = formatAgentClockTime(lastSyncedAt, false);
  const emptyTitle = hasSearch
    ? t("workbuddy.emptySearchTitle")
    : dir === "sent"
      ? t("workbuddy.emptySentTitle")
      : t("workbuddy.emptyInboxTitle");

  return (
    <section
      className="panel-card mail-list-pane wb-list-pane"
      aria-label={title}
    >
      <WorkBuddyListHeader
        title={title}
        subtitle={subtitle}
        dir={dir}
        searchQuery={searchQuery}
        dailyQuota={dailyQuota}
        listLoading={listLoading}
        onChangeDir={onChangeDir}
        onChangeSearch={onChangeSearch}
        onRefresh={onRefresh}
      />

      {activeError && (
        <div className="wb-inline-alert" role="alert">
          <Icon name="alertCircle" size={14} />
          <span className="truncate" style={{ flex: 1 }}>
            {activeError.message}
          </span>
          {activeError.code === "ERR_WB_AUTH_REQUIRED" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onReauthorize}
            >
              {t("workbuddy.reauthorizeBtn")}
            </button>
          )}
        </div>
      )}

      <FadeScroll
        key={`${dir}:${hasSearch ? searchQuery.trim() : "all"}`}
        className="mail-list-scroll wb-list-scroll"
        label={title}
      >
        {listLoading && messages.length === 0 ? (
          <MailListSkeleton compact={compact} />
        ) : messages.length === 0 ? (
          <div className="list-empty-state">
            <span className="list-empty-icon-box" aria-hidden="true">
              <Icon name="inbox" size={22} />
            </span>
            <strong className="wb-empty-title">{emptyTitle}</strong>
            <p className="wb-empty-desc">{t("workbuddy.emptyListDesc")}</p>
          </div>
        ) : (
          <>
            <div className="list-group-head">
              <span className="truncate">
                {syncClock
                  ? t("workbuddy.listGroupSyncedAt", { time: syncClock })
                  : t("workbuddy.listGroupRecent")}
              </span>
              <span className="list-group-range">
                1–{messages.length} / {messages.length}
              </span>
            </div>
            {messages.map((item) => (
              <WorkBuddyMailCard
                key={item.messageId}
                item={item}
                dir={dir}
                compact={compact}
                selected={item.messageId === selectedMessageId}
                detailBodyFormat={
                  item.messageId === selectedMessageId
                    ? selectedDetailFormat
                    : undefined
                }
                onSelect={() => onSelectMessage(item.messageId)}
              />
            ))}
            {hasMore && (
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
            )}
          </>
        )}
      </FadeScroll>
    </section>
  );
}
