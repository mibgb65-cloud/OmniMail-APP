import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { useState, type CSSProperties, type MouseEvent } from "react";
import { useApp } from "../../state/AppContext";
import type { FolderId, MailFilterTab, MailItem } from "../../types/mail";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { MailCard } from "./MailCard";
import { MailContextMenu } from "./MailContextMenu";
import { MailListBatchBar, MailListEmptyState } from "./MailListExtras";

const FOLDER_TITLES: Record<FolderId, string> = {
  inbox: "统一收件箱",
  starred: "星标邮件",
  snoozed: "稍后处理",
  sent: "已发送",
  drafts: "草稿箱",
  archive: "归档邮件",
  outbox: "待发送队列",
  scheduled: "定时邮件",
  spam: "垃圾邮件",
  trash: "回收站",
};

export function MailListPane() {
  const { viewport, workspace, mailStore, triggerSyncAll } = useApp();
  const [menuState, setMenuState] = useState<{
    mail: MailItem;
    x: number;
    y: number;
  } | null>(null);
  const {
    filteredMails,
    selectedMail,
    activeFolder,
    activeAccountId,
    activeLabelId,
    labels,
    filterTab,
    searchQuery,
    checkedIds,
  } = mailStore;
  const isCompact = viewport === "compact";
  const noAccounts = workspace.accounts.length === 0;
  const activeAccount = workspace.accounts.find(
    (a) => a.id === activeAccountId,
  );
  const activeLabel = labels.find((l) => l.id === activeLabelId);
  const title = searchQuery.trim()
    ? `搜索：“${searchQuery.trim()}”`
    : activeLabel
      ? `标签 · ${activeLabel.name}`
      : FOLDER_TITLES[activeFolder];
  const unreadCount = filteredMails.filter((m) => m.unread).length;
  const badgeCount = mailStore.folderCounts[activeFolder] ?? unreadCount;
  const displayTotal = mailStore.totalCount || filteredMails.length;
  const subtitle = activeAccount
    ? `${activeAccount.shortTag} · ${displayTotal} 封邮件`
    : `${workspace.accounts.length} 个邮箱 · ${badgeCount} 封未读`;
  const tabs: Array<{ id: MailFilterTab; label: string }> = [
    { id: "all", label: "全部" },
    { id: "unread", label: isCompact ? "未读" : `未读 ${badgeCount}` },
    { id: "starred", label: "星标" },
    { id: "attachments", label: "附件" },
  ];
  const activeTabIdx = Math.max(
    0,
    tabs.findIndex((t) => t.id === filterTab),
  );
  const handleContext = (mail: MailItem, e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ mail, x: e.clientX, y: e.clientY });
  };

  return (
    <section className="panel-card mail-list-pane" aria-label="邮件列表">
      <div className="list-header">
        <div className="list-title-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <h1 className="list-title truncate">{title}</h1>
              {isCompact && badgeCount > 0 && (
                <span className="list-unread-badge">{badgeCount}</span>
              )}
            </div>
            {!isCompact && <p className="list-subtitle truncate">{subtitle}</p>}
          </div>

          <div className="row" style={{ gap: 5, flexShrink: 0 }}>
            {activeFolder === "trash" && filteredMails.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-danger-soft"
                onClick={() =>
                  workspace.setOverlay({
                    type: "danger-confirm",
                    kind: "empty-trash",
                    targetLabel: `${filteredMails.length} 封回收站邮件`,
                  })
                }
              >
                清空
              </button>
            )}
            {!isCompact && (
              <Tooltip label="刷新同步" shortcut="Ctrl+R">
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered list-head-icon-btn"
                  onClick={triggerSyncAll}
                  aria-label="刷新同步"
                >
                  <Icon name="refresh" size={13} />
                </button>
              </Tooltip>
            )}
            <Tooltip label="高级筛选">
              <button
                type="button"
                className="icon-btn icon-btn-bordered list-head-icon-btn"
                onClick={() =>
                  workspace.setOverlay({ type: "advanced-search" })
                }
                aria-label="高级筛选"
              >
                <Icon name="filter" size={13} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div
          className="filter-tabs"
          role="tablist"
          style={{ "--active-tab-idx": activeTabIdx } as CSSProperties}
        >
          <span className="filter-tabs-indicator" aria-hidden="true" />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filterTab === tab.id}
              className={`filter-tab ${filterTab === tab.id ? "active" : ""}`}
              onClick={() => mailStore.setFilterTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <MailListBatchBar />

      {filteredMails.length === 0 ? (
        <MailListEmptyState noAccounts={noAccounts} />
      ) : (
        <FadeScroll
          className="mail-list-scroll"
          label="邮件列表"
          viewportProps={{
            onScroll: (e) => {
              const el = e.currentTarget;
              if (
                mailStore.hasMore &&
                el.scrollHeight - el.scrollTop - el.clientHeight < 120
              ) {
                void mailStore.loadMore();
              }
            },
          }}
        >
          {!isCompact && (
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
              compact={isCompact}
              selected={selectedMail?.id === mail.id}
              checked={checkedIds.includes(mail.id)}
              selectionMode={checkedIds.length > 0}
              onSelect={() => mailStore.openMail(mail.id)}
              onToggleCheck={() => mailStore.toggleChecked(mail.id)}
              onContextMenu={(e) => handleContext(mail, e)}
            />
          ))}
        </FadeScroll>
      )}

      <MailContextMenu state={menuState} onClose={() => setMenuState(null)} />
    </section>
  );
}
