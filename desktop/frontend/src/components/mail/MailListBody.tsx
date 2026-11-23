import { ArrowUpIcon } from "@heroicons/react/24/outline";
import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { useApp } from "../../state/AppContext";
import type { MailItem } from "../../types/mail";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MailCard } from "./MailCard";
import { MailListEmptyState } from "./MailListExtras";

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
  const { workspace, mailStore, aiStore } = useApp();
  const { filteredMails, selectedMail, checkedIds, listScope, listScroll } =
    mailStore;
  const { showPill, newCount, onScrollPosition } = listScroll;
  const viewport = useRef<HTMLDivElement>(null);
  const hasItems = filteredMails.length > 0;
  const visible = showPill && !readOnlyExit;

  useLayoutEffect(() => {
    if (readOnlyExit) return;
    if (viewport.current) viewport.current.scrollTop = 0;
    onScrollPosition(0);
  }, [hasItems, listScope, onScrollPosition, readOnlyExit]);

  const scrollToTop = () => {
    const el = viewport.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  if (!hasItems)
    return <MailListEmptyState noAccounts={workspace.accounts.length === 0} />;

  return (
    <div className="mail-list-body">
      <FadeScroll
        className="mail-list-scroll"
        data-return-pill={visible}
        label="邮件列表"
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
            <span className="truncate">最新优先</span>
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
      <button
        type="button"
        className="mail-list-return-top"
        data-visible={visible}
        data-new-mail={newCount > 0}
        aria-hidden={!visible}
        disabled={!visible}
        tabIndex={visible ? 0 : -1}
        aria-label={
          newCount > 0 ? `回到顶部查看 ${newCount} 封新邮件` : "回到顶部"
        }
        onClick={scrollToTop}
      >
        <ArrowUpIcon
          width={13}
          height={13}
          strokeWidth={1.8}
          aria-hidden="true"
          focusable="false"
        />
        {newCount > 0 ? `${newCount} 封新邮件` : "回到顶部"}
      </button>
    </div>
  );
}
