import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { classifyMuseViewState } from "../../types/muse";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { MuseStateCard } from "./MuseStateCard";
import { MuseThreadListPane } from "./MuseThreadListPane";
import { MuseThreadReaderPane } from "./MuseThreadReaderPane";

function formatLastRefreshed(
  ms: number,
  lang: string,
  notYet: string,
  formatTemplate: (time: string) => string,
): string {
  if (!ms || ms <= 0) return notYet;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return notYet;
  const hm = new Intl.DateTimeFormat(lang === "en-US" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  return formatTemplate(hm);
}

export function MuseMailView({
  readOnlyExit = false,
}: {
  readOnlyExit?: boolean;
}) {
  const { workspace, museStore } = useApp();
  const { lang, t } = useI18n();
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
  const refreshedLabel = formatLastRefreshed(
    status.lastRefreshedAt,
    lang,
    t("muse.notRefreshedYet"),
    (tm) => t("muse.lastRefreshedAt", { time: tm }),
  );

  return (
    <div className="muse-view-root" aria-hidden={readOnlyExit || undefined}>
      <header className="panel-card muse-topbar-card">
        <div className="muse-topbar-left">
          <ProviderIcon provider="muse" size={28} />
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <strong className="muse-topbar-name truncate">
                {status.accountName || t("muse.providerName")}
              </strong>
              {status.verifiedEmail && (
                <span className="muse-verified-chip">
                  {status.verifiedEmail}
                </span>
              )}
            </div>
            <div className="text-xs text-muted">{refreshedLabel}</div>
          </div>
        </div>

        <div className="muse-topbar-actions">
          {status.bound && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (refreshing) void museStore.cancelRefresh();
                else void museStore.refreshThreads();
              }}
            >
              <Icon name={refreshing ? "square" : "refresh"} size={13} />
              <span>
                {refreshing
                  ? t("muse.cancelRefreshBtn")
                  : t("muse.manualRefreshBtn")}
              </span>
            </button>
          )}

          {status.bound && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void museStore.disconnect()}
            >
              <Icon name="x" size={13} />
              <span>{t("muse.disconnectBtn")}</span>
            </button>
          )}
        </div>
      </header>

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
        <div className="muse-columns">
          <MuseThreadListPane
            threads={threads}
            selectedThreadId={selectedThreadId}
            listLoading={listLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            compact={workspace.settings.density === "compact"}
            onSelectThread={(id) => void museStore.selectThread(id)}
            onLoadMore={() => void museStore.loadMoreThreads()}
          />
          <MuseThreadReaderPane detail={threadDetail} loading={detailLoading} />
        </div>
      )}
    </div>
  );
}
