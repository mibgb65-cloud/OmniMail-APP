import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { resolveMailListViewPhase } from "../../state/mailListLoadingPolicy";
import type { MailItem } from "../../types/mail";
import {
  ScrollToTopPill,
  scrollViewportToTop,
} from "../common/ScrollToTopPill";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailCard } from "./MailCard";
import { MailListEmptyState, MailListLoadError } from "./MailListExtras";
import { MailListFooter } from "./MailListFooter";
import { MailListSkeleton } from "./MailListSkeleton";

const TODAY_TIME_RE =
  /^(?:\d{1,2}:\d{2}|刚刚|今天|Just now|Today|\d+\s*(?:分钟前|m ago))$/i;

export function MailListBody({
  compact,
  displayTotal,
  onContextMenu,
  readOnlyExit,
}: {
  compact: boolean;
  displayTotal: number;
  onContextMenu: (mail: MailItem, event: MouseEvent<HTMLDivElement>) => void;
  readOnlyExit: boolean;
}) {
  const { t } = useI18n();
  const { workspace, mailStore, aiStore } = useApp();
  const {
    filteredMails,
    selectedMail,
    checkedIds,
    listScope,
    listScopeKey,
    listScroll,
    isInitialLoading,
    listError,
    hasMore,
    hasRemoteMore,
    remoteTotalCount,
    loadingMore,
    loadingRemoteOlder,
    loadMoreError,
    canAutoBackfill,
    canManualBackfill,
    loadMore,
    reloadMessages,
  } = mailStore;
  const { showPill, newCount, onScrollPosition } = listScroll;
  const viewport = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const phase = resolveMailListViewPhase({
    accountCount: workspace.accounts.length,
    isInitialLoading,
    listError,
    itemCount: filteredMails.length,
  });
  const isReady = phase === "ready";
  const visible = showPill && !readOnlyExit;
  const topFromToday = TODAY_TIME_RE.test(
    filteredMails[0]?.timeText.trim() ?? "",
  );
  const canAutoLoadNext =
    isReady &&
    !readOnlyExit &&
    !loadingMore &&
    !loadingRemoteOlder &&
    !loadMoreError &&
    (hasMore || (hasRemoteMore && canAutoBackfill));

  useLayoutEffect(() => {
    if (readOnlyExit) return;
    if (viewport.current) viewport.current.scrollTop = 0;
    onScrollPosition(0);
  }, [isReady, listScope, onScrollPosition, readOnlyExit]);

  useEffect(() => {
    if (!canAutoLoadNext || typeof IntersectionObserver === "undefined") return;
    const root = viewport.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore(false);
        }
      },
      { root, rootMargin: "0px 0px 240px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canAutoLoadNext, filteredMails.length, loadMore]);

  if (phase === "no-accounts") return <MailListEmptyState noAccounts />;
  if (phase === "loading") return <MailListSkeleton compact={compact} />;
  if (phase === "error") {
    return (
      <MailListLoadError
        detail={listError}
        onRetry={() => void reloadMessages(true)}
      />
    );
  }
  if (phase === "empty") return <MailListEmptyState />;

  return (
    <div className="mail-list-body">
      <FadeScroll
        className="mail-list-scroll"
        data-return-pill={visible}
        label={t("mailList.ariaPane")}
        viewportProps={{
          ref: viewport,
          onScroll: (event) => {
            if (readOnlyExit) return;
            const el = event.currentTarget;
            onScrollPosition(el.scrollTop);
            if (
              canAutoLoadNext &&
              el.scrollHeight - el.scrollTop - el.clientHeight < 240
            ) {
              void loadMore(false);
            }
          },
        }}
      >
        {!compact && (
          <div className="list-group-head">
            <span className="truncate">
              {t(
                topFromToday
                  ? "mailList.todayNewestFirst"
                  : "mailList.newestFirst",
              )}
            </span>
            <span className="list-group-range">
              1–{filteredMails.length} / {displayTotal}
            </span>
          </div>
        )}
        <div key={listScopeKey} className="mail-list-cards-stage">
          {filteredMails.map((mail) => (
            <MailCard
              key={mail.id}
              mail={mail}
              summarized={aiStore.hasMailSummary(mail)}
              compact={compact}
              selected={selectedMail?.id === mail.id}
              checked={checkedIds.includes(mail.id)}
              selectionMode={checkedIds.length > 0}
              onSelect={() => mailStore.openMail(mail.id)}
              onToggleCheck={() => mailStore.toggleChecked(mail.id)}
              onContextMenu={(event) => onContextMenu(mail, event)}
            />
          ))}
        </div>
        <MailListFooter
          loadingMore={loadingMore}
          loadingRemoteOlder={loadingRemoteOlder}
          loadMoreError={loadMoreError}
          hasMore={hasMore}
          hasRemoteMore={hasRemoteMore}
          loadedCount={filteredMails.length}
          displayTotal={displayTotal}
          remoteTotalCount={remoteTotalCount}
          canManualBackfill={canManualBackfill}
          onRetry={() => void loadMore(true)}
          onManualLoadOlder={() => void loadMore(true)}
        />
        <div
          ref={sentinelRef}
          className="mail-list-sentinel"
          aria-hidden="true"
        />
      </FadeScroll>
      <ScrollToTopPill
        className="mail-list-return-top"
        visible={visible}
        accent={newCount > 0}
        label={
          newCount > 0
            ? t("mailList.newEmailsPill", { count: newCount })
            : t("common.backToTop")
        }
        ariaLabel={
          newCount > 0
            ? t("mailList.newEmailsAria", { count: newCount })
            : t("common.backToTop")
        }
        onClick={() => scrollViewportToTop(viewport.current)}
      />
    </div>
  );
}
