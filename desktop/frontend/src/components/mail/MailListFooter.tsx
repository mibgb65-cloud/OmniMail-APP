import { useI18n } from "../../i18n";
import { resolveMailListFooterKind } from "../../state/mailListBackfillPolicy";

interface MailListFooterProps {
  loadingMore: boolean;
  loadingRemoteOlder: boolean;
  loadMoreError: string;
  hasMore: boolean;
  hasRemoteMore: boolean;
  loadedCount: number;
  displayTotal: number;
  remoteTotalCount: number;
  canManualBackfill: boolean;
  onRetry: () => void;
  onManualLoadOlder: () => void;
}

function FooterSpinner({ tone }: { tone: "neutral" | "accent" }) {
  return (
    <span
      className={`mail-list-footer-spinner is-${tone}`}
      aria-hidden="true"
    />
  );
}

function MailCardSkeleton({ variant }: { variant: 1 | 2 }) {
  return (
    <div className={`mail-card-skeleton is-v${variant}`} aria-hidden="true">
      <div className="mail-card-skeleton-row">
        <span className="mail-card-skeleton-bar sk-sender" />
        <span className="mail-card-skeleton-bar sk-time" />
      </div>
      <span className="mail-card-skeleton-bar sk-subject" />
      <span className="mail-card-skeleton-bar sk-snippet" />
      {variant === 1 && <span className="mail-card-skeleton-bar sk-tag" />}
    </div>
  );
}

export function MailListFooter({
  loadingMore,
  loadingRemoteOlder,
  loadMoreError,
  hasMore,
  hasRemoteMore,
  loadedCount,
  displayTotal,
  remoteTotalCount,
  canManualBackfill,
  onRetry,
  onManualLoadOlder,
}: MailListFooterProps) {
  const { t } = useI18n();
  const kind = resolveMailListFooterKind({
    loadingMore,
    loadingRemoteOlder,
    loadMoreError,
    hasMore,
    hasRemoteMore,
    loadedCount,
    canManualBackfill,
  });

  if (kind === "none") return null;

  if (kind === "local-loading") {
    return (
      <div className="mail-list-footer" role="status" aria-live="polite">
        <div className="mail-list-status-pill is-local">
          <FooterSpinner tone="neutral" />
          <span>{t("mailList.loadingMore")}</span>
        </div>
      </div>
    );
  }

  if (kind === "remote-loading") {
    const showProgress = remoteTotalCount > displayTotal && displayTotal > 0;
    return (
      <div className="mail-list-footer" role="status" aria-live="polite">
        <MailCardSkeleton variant={1} />
        <MailCardSkeleton variant={2} />
        <div className="mail-list-status-pill is-remote">
          <FooterSpinner tone="accent" />
          <span className="truncate">
            {showProgress
              ? t("mailList.loadingRemoteOlderProgress", {
                  synced: displayTotal,
                  total: remoteTotalCount,
                })
              : t("mailList.loadingRemoteOlder")}
          </span>
        </div>
      </div>
    );
  }

  if (kind === "manual-more") {
    const remaining = Math.max(0, remoteTotalCount - displayTotal);
    return (
      <div className="mail-list-footer">
        <div className="mail-list-status-pill is-manual">
          <span className="mail-list-status-text">
            {remaining > 0
              ? t("mailList.remoteMoreAvailableCount", { remaining })
              : t("mailList.remoteMoreAvailable")}
          </span>
          <button
            type="button"
            className="mail-list-footer-btn"
            onClick={onManualLoadOlder}
          >
            {t("mailList.loadOlderBtn")}
          </button>
        </div>
      </div>
    );
  }

  if (kind === "error") {
    return (
      <div className="mail-list-footer" role="alert">
        <div className="mail-list-status-pill is-error">
          <span className="mail-list-status-text">
            {t("mailList.loadMoreFailed", { reason: loadMoreError })}
          </span>
          <button
            type="button"
            className="mail-list-footer-btn is-error"
            onClick={onRetry}
          >
            {t("mailList.retryLoadMoreBtn")}
          </button>
        </div>
      </div>
    );
  }

  const endTotal = Math.max(loadedCount, displayTotal);
  return (
    <div className="mail-list-footer">
      <div className="mail-list-end-line">
        <span className="mail-list-end-rule" aria-hidden="true" />
        <span className="mail-list-end-text">
          {t("mailList.allMailsLoaded", { count: endTotal })}
        </span>
        <span className="mail-list-end-rule" aria-hidden="true" />
      </div>
    </div>
  );
}
