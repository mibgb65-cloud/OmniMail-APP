import { useApp } from "../../state/AppContext";
import { classifyMuseViewState } from "../../types/muse";
import { MuseStateCard } from "./MuseStateCard";
import { MuseThreadListPane } from "./MuseThreadListPane";
import { MuseThreadReaderPane } from "./MuseThreadReaderPane";

export function MuseMailView({
  readOnlyExit = false,
}: {
  readOnlyExit?: boolean;
}) {
  const { workspace, museStore } = useApp();
  const {
    status,
    threads,
    hasMore,
    selectedThreadId,
    threadDetail,
    listLoading,
    loadingMore,
    detailLoading,
    activeError,
    clearedBySessionReset,
  } = museStore;

  const stateKind = classifyMuseViewState({
    bound: status.bound,
    clearedBySessionReset,
    errorCode: activeError?.code || status.lastErrorCode,
    threadsCount: threads.length,
    loading: listLoading,
  });

  const refreshing = listLoading || loadingMore;
  const currentIndex = Math.max(
    0,
    threads.findIndex((x) => x.id === selectedThreadId),
  );
  const navigateThread = (delta: -1 | 1) => {
    const next = threads[currentIndex + delta];
    if (next) void museStore.selectThread(next.id);
  };

  return (
    <div className="muse-view-root" aria-hidden={readOnlyExit || undefined}>
      {stateKind !== "ready" ? (
        <section className="panel-card muse-state-stage">
          <MuseStateCard
            kind={stateKind}
            email={status.verifiedEmail}
            error={activeError}
            onRefresh={() => void museStore.refreshThreads()}
            onOpenConnect={() => workspace.setOverlay({ type: "muse-connect" })}
            onDisconnect={() => void museStore.disconnect()}
            onBackToMail={() => workspace.setScreen("mail")}
          />
        </section>
      ) : (
        <>
          <MuseThreadListPane
            accountName={status.accountName}
            verifiedEmail={status.verifiedEmail}
            lastRefreshedAt={status.lastRefreshedAt}
            threads={threads}
            selectedThreadId={selectedThreadId}
            listLoading={listLoading}
            loadingMore={loadingMore}
            refreshing={refreshing}
            hasMore={hasMore}
            compact={workspace.settings.density === "compact"}
            onRefreshOrCancel={() => {
              if (refreshing) void museStore.cancelRefresh();
              else void museStore.refreshThreads();
            }}
            onDisconnect={() => void museStore.disconnect()}
            onSelectThread={(id) => void museStore.selectThread(id)}
            onLoadMore={() => void museStore.loadMoreThreads()}
          />

          <MuseThreadReaderPane
            verifiedEmail={status.verifiedEmail}
            lastRefreshedAt={status.lastRefreshedAt}
            detail={threadDetail}
            loading={detailLoading}
            refreshing={refreshing}
            currentIndex={currentIndex}
            totalCount={threads.length}
            onNavigate={navigateThread}
            onRefresh={() => void museStore.refreshThreads()}
            onDisconnect={() => void museStore.disconnect()}
          />
        </>
      )}
    </div>
  );
}
