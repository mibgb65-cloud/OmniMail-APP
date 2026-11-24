import { useI18n, type TranslationKey } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { LiveSyncProgress } from "../../state/syncProgress";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const BADGE_BY_STATUS: Record<
  LiveSyncProgress["status"] | "waiting",
  readonly [TranslationKey, string]
> = {
  waiting: ["onboarding.syncBadgeWaiting", "pill-accent"],
  syncing: ["onboarding.syncBadgeSyncing", "pill-accent"],
  done: ["onboarding.syncBadgeDone", "pill-success"],
  partial: ["onboarding.syncBadgePartial", "pill-warning"],
  failed: ["onboarding.syncBadgeFailed", "pill-danger"],
};

export function SyncProgressModal({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const { workspace, desktopBridge } = useApp();
  const { t, localizeText } = useI18n();
  const live = desktopBridge.syncProgressByAccount.get(accountId);
  const [badgeKey, tone] = BADGE_BY_STATUS[live?.status ?? "waiting"];
  const inbox = live?.status === "syncing" && live.total > 0 ? live : null;

  const enterInbox = () => {
    workspace.setOverlay({ type: "none" });
    workspace.setScreen("mail");
  };

  return (
    <ModalShell
      heading={t("onboarding.syncProgressHeading")}
      subtitle={accountName}
      maxWidth={520}
      onClose={enterInbox}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={enterInbox}
          >
            {t("onboarding.runInBackgroundBtn")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={enterInbox}
          >
            {t("onboarding.enterUnifiedInboxBtn")}
          </button>
        </>
      }
    >
      <div className="settings-card" role="status">
        <div className="row-between">
          <strong style={{ fontSize: 15, color: "var(--text-ink)" }}>
            {live?.stage
              ? localizeText(live.stage)
              : t("onboarding.syncStageSoon")}
          </strong>
          <span className={`pill ${tone}`}>{t(badgeKey)}</span>
        </div>
        {inbox && (
          <div className="storage-bar" aria-hidden="true">
            <div
              style={{
                width: `${(inbox.current / inbox.total) * 100}%`,
                background: "var(--brand-accent)",
              }}
            />
          </div>
        )}
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          {inbox
            ? t("onboarding.syncProcessedCount", {
                current: inbox.current,
                total: inbox.total,
              })
            : live?.status === "failed" || live?.status === "partial"
              ? t("onboarding.syncFailedOrPartialHint")
              : t("onboarding.syncOnDemandAttHint")}
        </div>
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          <Icon name="shield" size={14} />
          <span>{t("onboarding.dpapiSavedHint")}</span>
        </div>
      </div>
    </ModalShell>
  );
}
