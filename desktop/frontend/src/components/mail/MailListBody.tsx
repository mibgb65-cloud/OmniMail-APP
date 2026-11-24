import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { MailItem } from "../../types/mail";
import {
  ScrollToTopPill,
  scrollViewportToTop,
} from "../common/ScrollToTopPill";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailCard } from "./MailCard";
import { MailListEmptyState } from "./MailListExtras";

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
  const { filteredMails, selectedMail, checkedIds, listScope, listScroll } =
    mailStore;
  const { showPill, newCount, onScrollPosition } = listScroll;
  const viewport = useRef<HTMLDivElement>(null);
  const hasItems = filteredMails.length > 0;
  const visible = showPill && !readOnlyExit;
  const topFromToday = TODAY_TIME_RE.test(
    filteredMails[0]?.timeText.trim() ?? "",
  );

  useLayoutEffect(() => {
    if (readOnlyExit) return;
    if (viewport.current) viewport.current.scrollTop = 0;
    onScrollPosition(0);
  }, [hasItems, listScope, onScrollPosition, readOnlyExit]);

  if (!hasItems)
    return <MailListEmptyState noAccounts={workspace.accounts.length === 0} />;

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
              mailStore.hasMore &&
              el.scrollHeight - el.scrollTop - el.clientHeight < 120
            )
              void mailStore.loadMore();
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
