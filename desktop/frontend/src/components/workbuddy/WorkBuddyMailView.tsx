import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { shouldShowDailyQuota } from "../../types/workbuddy";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { WorkBuddyListPane } from "./WorkBuddyListPane";
import { WorkBuddyDeleteModal } from "./WorkBuddyReaderExtras";
import { WorkBuddyReaderPane } from "./WorkBuddyReaderPane";

function formatSyncedTime(ms: number, lang: string): string {
  if (!ms || ms <= 0) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en-US" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function WorkBuddyMailView({
  readOnlyExit = false,
}: {
  readOnlyExit?: boolean;
}) {
  const { workspace, workBuddyStore } = useApp();
  const { lang, t } = useI18n();
  const {
    activeAccount,
    dir,
    setDir,
    searchQuery,
    setSearchQuery,
    dailyQuota,
    lastSyncedAt,
    messages,
    hasMore,
    selectedMessageId,
    messageDetail,
    listLoading,
    loadingMore,
    detailLoading,
    deleting,
    savingAttachmentId,
    pendingDelete,
    cancelDelete,
    activeError,
  } = workBuddyStore;

  const syncedTime = formatSyncedTime(lastSyncedAt, lang);
  const showQuota = shouldShowDailyQuota(dailyQuota);

  return (
    <div className="wb-view-root" aria-hidden={readOnlyExit || undefined}>
      <header className="panel-card wb-topbar-card">
        <div className="wb-topbar-left">
          <ProviderIcon provider="workbuddy" size={28} />
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <strong className="wb-topbar-name truncate">
                {activeAccount?.accountName || t("workbuddy.providerName")}
              </strong>
              {activeAccount?.email && (
                <span className="muse-verified-chip">
                  {activeAccount.email}
                </span>
              )}
              {showQuota && (
                <span className="wb-quota-pill">
                  {t("workbuddy.dailyQuotaBadge", {
                    remaining: dailyQuota.remaining,
                    limit: dailyQuota.limit,
                  })}
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              {syncedTime
                ? t("workbuddy.lastRefreshedAt", { time: syncedTime })
                : t("workbuddy.notRefreshedYet")}
            </div>
          </div>
        </div>

        <div className="wb-topbar-controls">
          <div className="wb-dir-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={dir === "inbox"}
              className={`wb-dir-tab ${dir === "inbox" ? "active" : ""}`}
              onClick={() => setDir("inbox")}
            >
              <Icon name="inbox" size={13} />
              <span>{t("workbuddy.inboxTab")}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dir === "sent"}
              className={`wb-dir-tab ${dir === "sent" ? "active" : ""}`}
              onClick={() => setDir("sent")}
            >
              <Icon name="send" size={13} />
              <span>{t("workbuddy.sentTab")}</span>
            </button>
          </div>

          <div className="wb-search-box">
            <Icon name="search" size={14} />
            <input
              className="wb-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("workbuddy.searchPlaceholder")}
            />
            {searchQuery && (
              <button
                type="button"
                className="icon-btn wb-search-clear"
                aria-label={t("workbuddy.clearSearchAria")}
                onClick={() => setSearchQuery("")}
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={listLoading}
            onClick={() => void workBuddyStore.refreshMessages()}
          >
            <Icon name="refresh" size={13} />
            <span>
              {listLoading
                ? t("workbuddy.refreshingBtn")
                : t("workbuddy.refreshBtn")}
            </span>
          </button>
        </div>
      </header>

      {activeError && (
        <div className="wb-error-banner" role="alert">
          <Icon name="alertCircle" size={15} />
          <span>{activeError.message}</span>
          {activeError.code === "ERR_WB_AUTH_REQUIRED" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                workspace.setOverlay({ type: "workbuddy-connect" })
              }
            >
              {t("workbuddy.reauthorizeBtn")}
            </button>
          )}
        </div>
      )}

      <div className="wb-columns">
        <WorkBuddyListPane
          dir={dir}
          searchQuery={searchQuery}
          messages={messages}
          selectedMessageId={selectedMessageId}
          listLoading={listLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          compact={workspace.settings.density === "compact"}
          onSelectMessage={(id) => void workBuddyStore.selectMessage(id)}
          onLoadMore={() => void workBuddyStore.loadMoreMessages()}
        />

        <WorkBuddyReaderPane
          detail={messageDetail}
          loading={detailLoading}
          savingAttachmentId={savingAttachmentId}
          onMarkRead={() => void workBuddyStore.markCurrentRead()}
          onSaveAttachment={(att) => void workBuddyStore.saveAttachment(att)}
          onRequestDelete={(id, subj) =>
            void workBuddyStore.requestDelete(id, subj)
          }
        />
      </div>

      <WorkBuddyDeleteModal
        target={pendingDelete}
        deleting={deleting}
        onCancel={cancelDelete}
        onConfirm={() => void workBuddyStore.confirmDelete()}
      />
    </div>
  );
}
