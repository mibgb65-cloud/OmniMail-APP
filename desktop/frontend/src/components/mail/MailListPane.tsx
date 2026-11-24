import { useState, type CSSProperties, type MouseEvent } from "react";
import { useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { FolderId, MailFilterTab, MailItem } from "../../types/mail";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { MailContextMenu } from "./MailContextMenu";
import { MailListBatchBar } from "./MailListExtras";
import { MailListBody } from "./MailListBody";

const FOLDER_TITLE_KEYS: Record<FolderId, TranslationKey> = {
  inbox: "sidebar.unifiedInbox",
  starred: "sidebar.starred",
  snoozed: "sidebar.snoozed",
  sent: "sidebar.sent",
  drafts: "sidebar.drafts",
  archive: "sidebar.archive",
  outbox: "sidebar.outbox",
  scheduled: "sidebar.scheduled",
  spam: "sidebar.spam",
  trash: "sidebar.trash",
};

export function MailListPane({
  readOnlyExit = false,
}: {
  readOnlyExit?: boolean;
}) {
  const { t } = useI18n();
  const { viewport, workspace, mailStore, triggerSyncAll } = useApp();
  const [menuState, setMenuState] = useState<{
    mail: MailItem;
    x: number;
    y: number;
  } | null>(null);
  const {
    filteredMails,
    activeFolder,
    activeAccountId,
    activeLabelId,
    labels,
    filterTab,
    searchQuery,
    listScroll,
  } = mailStore;
  const isCompact = viewport === "compact";
  const activeAccount = workspace.accounts.find(
    (a) => a.id === activeAccountId,
  );
  const activeLabel = labels.find((l) => l.id === activeLabelId);
  const title = searchQuery.trim()
    ? t("mailList.searchTitle", { query: searchQuery.trim() })
    : activeLabel
      ? t("mailList.labelTitle", { name: activeLabel.name })
      : t(FOLDER_TITLE_KEYS[activeFolder]);
  const unreadCount = filteredMails.filter((m) => m.unread).length;
  const badgeCount = mailStore.folderCounts[activeFolder] ?? unreadCount;
  const displayTotal = mailStore.totalCount || filteredMails.length;
  const subtitle = activeAccount
    ? t("mailList.accountSubtitle", {
        tag: activeAccount.shortTag,
        total: displayTotal,
      })
    : t("mailList.unifiedSubtitle", {
        accounts: workspace.accounts.length,
        unread: badgeCount,
      });
  const tabs: Array<{ id: MailFilterTab; label: string }> = [
    { id: "all", label: t("mailList.tabAll") },
    {
      id: "unread",
      label:
        isCompact || badgeCount <= 0
          ? t("mailList.tabUnread")
          : t("mailList.tabUnreadCount", { count: badgeCount }),
    },
    { id: "starred", label: t("mailList.tabStarred") },
    { id: "attachments", label: t("mailList.tabFiles") },
  ];
  const activeTabIdx = Math.max(
    0,
    tabs.findIndex((item) => item.id === filterTab),
  );
  const handleContext = (mail: MailItem, e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ mail, x: e.clientX, y: e.clientY });
  };

  return (
    <section
      className="panel-card mail-list-pane"
      aria-label={t("mailList.ariaPane")}
    >
      <div className="list-header" data-scrolled={listScroll.scrolled}>
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
                    targetLabel: t("mailList.trashTargetCount", {
                      count: filteredMails.length,
                    }),
                  })
                }
              >
                {t("common.clear")}
              </button>
            )}
            {!isCompact && (
              <Tooltip label={t("mailList.refreshSyncTip")} shortcut="Ctrl+R">
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered list-head-icon-btn"
                  onClick={triggerSyncAll}
                  aria-label={t("mailList.refreshSyncTip")}
                >
                  <Icon name="refresh" size={13} />
                </button>
              </Tooltip>
            )}
            <Tooltip label={t("mailList.advancedFilterTip")}>
              <button
                type="button"
                className="icon-btn icon-btn-bordered list-head-icon-btn"
                onClick={() =>
                  workspace.setOverlay({ type: "advanced-search" })
                }
                aria-label={t("mailList.advancedFilterTip")}
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

      <MailListBody
        compact={isCompact}
        displayTotal={displayTotal}
        onContextMenu={handleContext}
        readOnlyExit={readOnlyExit}
      />
      <MailContextMenu state={menuState} onClose={() => setMenuState(null)} />
    </section>
  );
}
