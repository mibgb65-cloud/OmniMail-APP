import { useApp } from "../../state/AppContext";
import { WorkBuddyListPane } from "./WorkBuddyListPane";
import { WorkBuddyDeleteModal } from "./WorkBuddyReaderExtras";
import { WorkBuddyReaderPane } from "./WorkBuddyReaderPane";

export function WorkBuddyMailView({
  readOnlyExit = false,
}: {
  readOnlyExit?: boolean;
}) {
  const { workspace, workBuddyStore } = useApp();
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

  const currentIndex = Math.max(
    0,
    messages.findIndex((m) => m.messageId === selectedMessageId),
  );
  const navigateMessage = (delta: -1 | 1) => {
    const next = messages[currentIndex + delta];
    if (next) void workBuddyStore.selectMessage(next.messageId);
  };

  return (
    <div className="wb-view-root" aria-hidden={readOnlyExit || undefined}>
      <WorkBuddyListPane
        account={activeAccount}
        dir={dir}
        searchQuery={searchQuery}
        dailyQuota={dailyQuota}
        lastSyncedAt={lastSyncedAt}
        messages={messages}
        selectedMessageId={selectedMessageId}
        selectedDetailFormat={
          messageDetail?.messageId === selectedMessageId
            ? messageDetail.bodyFormat
            : undefined
        }
        listLoading={listLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        compact={workspace.settings.density === "compact"}
        activeError={activeError}
        onChangeDir={setDir}
        onChangeSearch={setSearchQuery}
        onRefresh={() => void workBuddyStore.refreshMessages()}
        onSelectMessage={(id) => void workBuddyStore.selectMessage(id)}
        onLoadMore={() => void workBuddyStore.loadMoreMessages()}
        onReauthorize={() =>
          workspace.setOverlay({ type: "workbuddy-connect" })
        }
      />

      <WorkBuddyReaderPane
        account={activeAccount}
        dir={dir}
        dailyQuota={dailyQuota}
        lastSyncedAt={lastSyncedAt}
        detail={messageDetail}
        loading={detailLoading}
        savingAttachmentId={savingAttachmentId}
        currentIndex={currentIndex}
        totalCount={messages.length}
        onNavigate={navigateMessage}
        onMarkRead={() => void workBuddyStore.markCurrentRead()}
        onRefreshBody={() => {
          if (selectedMessageId) {
            void workBuddyStore.selectMessage(selectedMessageId);
          }
        }}
        onSaveAttachment={(att) => void workBuddyStore.saveAttachment(att)}
        onRequestDelete={(id, subj) =>
          void workBuddyStore.requestDelete(id, subj)
        }
      />

      <WorkBuddyDeleteModal
        target={pendingDelete}
        deleting={deleting}
        onCancel={cancelDelete}
        onConfirm={() => void workBuddyStore.confirmDelete()}
      />
    </div>
  );
}
