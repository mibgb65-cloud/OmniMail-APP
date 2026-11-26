import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { MuseThreadDetail } from "../../types/muse";
import { formatAgentClockTime } from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { MuseMessageCard } from "./MuseMessageCard";

export function MuseThreadReaderPane({
  verifiedEmail,
  lastRefreshedAt,
  detail,
  loading,
  refreshing,
  currentIndex,
  totalCount,
  onNavigate,
  onRefresh,
  onDisconnect,
}: {
  verifiedEmail: string;
  lastRefreshedAt: number;
  detail: MuseThreadDetail | null;
  loading: boolean;
  refreshing: boolean;
  currentIndex: number;
  totalCount: number;
  onNavigate: (delta: -1 | 1) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  const { toastStore } = useApp();
  const { t } = useI18n();
  const syncedClock = formatAgentClockTime(lastRefreshedAt, true);
  const navText = `${currentIndex + 1} / ${Math.max(1, totalCount)}`;

  const copyMailbox = () => {
    if (!verifiedEmail) return;
    void navigator.clipboard?.writeText(verifiedEmail).catch(() => undefined);
    toastStore.pushToast({
      tone: "success",
      title: t("muse.copiedMailboxToast", { email: verifiedEmail }),
    });
  };

  return (
    <section
      className="panel-card mail-reader-pane muse-reader-pane"
      aria-label={t("muse.providerName")}
    >
      <div className="reader-toolbar wb-reader-toolbar">
        <div className="wb-toolbar-left">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <Icon name="refresh" size={13} />
            <span>{t("muse.manualRefreshBtn")}</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={!verifiedEmail}
            onClick={copyMailbox}
          >
            <Icon name="copy" size={13} />
            <span>{t("muse.copyMailboxBtn")}</span>
          </button>
          <span className="wb-toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onDisconnect}
          >
            <Icon name="x" size={13} />
            <span>{t("muse.disconnectBtn")}</span>
          </button>
        </div>

        <div className="wb-toolbar-nav">
          <span className="wb-nav-count">{navText}</span>
          <Tooltip label={t("reader.prevMailTip")}>
            <button
              type="button"
              className="icon-btn icon-btn-bordered wb-nav-icon-btn"
              disabled={currentIndex <= 0}
              aria-label={t("reader.prevMailTip")}
              onClick={() => onNavigate(-1)}
            >
              <Icon name="chevronLeft" size={13} />
            </button>
          </Tooltip>
          <Tooltip label={t("reader.nextMailTip")}>
            <button
              type="button"
              className="icon-btn icon-btn-bordered wb-nav-icon-btn"
              disabled={currentIndex >= totalCount - 1}
              aria-label={t("reader.nextMailTip")}
              onClick={() => onNavigate(1)}
            >
              <Icon name="chevronRight" size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {loading ? (
        <div className="muse-reader-placeholder" role="status">
          <span
            className="omni-shimmer-bar"
            style={{ width: "54%", height: 18 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "36%", height: 12 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "88%", height: 84 }}
          />
        </div>
      ) : !detail ? (
        <div className="muse-reader-empty">
          <Icon name="mail" size={26} />
          <strong>{t("muse.selectThreadHintTitle")}</strong>
          <span className="text-xs text-muted">
            {t("muse.selectThreadHintDesc")}
          </span>
        </div>
      ) : (
        <div className="reader-body">
          <FadeScroll
            key={detail.id}
            className="reader-scroll selectable"
            label={detail.subject || t("muse.providerName")}
          >
            <div className="reader-badges-row">
              <div className="reader-badges-chips">
                <span className="pill pill-neutral reader-account-pill">
                  <ProviderIcon provider="muse" size={16} />
                  <span>
                    {verifiedEmail ? `Muse · ${verifiedEmail}` : "Muse Mail"}
                  </span>
                </span>
                <span className="pill pill-accent">
                  {t("muse.readOnlyModeBadge")}
                </span>
              </div>
              <span className="reader-thread-meta">
                {t("reader.threadCountMeta", { count: detail.messages.length })}
              </span>
            </div>

            <h2 className="reader-subject">
              {detail.subject || t("muse.noSubjectFallback")}
            </h2>
            <div className="muse-reader-subnote">
              <Icon name="clock" size={13} />
              <span>{t("muse.serverTimeSemanticNote")}</span>
            </div>

            <div className="muse-msg-stack">
              {detail.messages.map((msg) => (
                <MuseMessageCard key={msg.id} msg={msg} />
              ))}
            </div>
          </FadeScroll>
        </div>
      )}

      <footer className="wb-reader-footer">
        <div className="wb-footer-status">
          <span className="wb-footer-dot" aria-hidden="true" />
          <span className="truncate">
            {syncedClock
              ? t("muse.footerSyncedStatus", { time: syncedClock })
              : t("muse.footerIdleStatus")}
          </span>
        </div>
        <div className="wb-footer-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!verifiedEmail}
            onClick={copyMailbox}
          >
            {t("muse.copyMailboxBtn")}
          </button>
        </div>
      </footer>
    </section>
  );
}
