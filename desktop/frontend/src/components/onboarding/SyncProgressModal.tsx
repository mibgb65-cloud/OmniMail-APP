import { useEffect } from "react";
import { accountApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { SYNC_STAGE_INFO, type SyncStage } from "./syncStageMeta";

export function SyncProgressModal({
  accountId,
  accountName,
  stage,
}: {
  accountId?: string;
  accountName: string;
  stage: SyncStage;
}) {
  const { workspace, desktopBridge, toastStore } = useApp();
  const live = desktopBridge.syncProgress;
  const matchesLive = Boolean(
    live && (!accountId || live.accountId === accountId),
  );
  const resolvedStage: SyncStage =
    matchesLive && (live?.percent ?? 0) >= 100 ? "done" : stage;
  const info = SYNC_STAGE_INFO[resolvedStage];
  const pct = matchesLive ? (live?.percent ?? info.progress) : info.progress;

  useEffect(() => {
    if (accountId) {
      void accountApi.triggerSync(accountId).catch(() => undefined);
    }
  }, [accountId]);

  const enterInbox = () => {
    workspace.setOverlay({ type: "none" });
    workspace.setScreen("mail");
    toastStore.pushToast({
      tone: "success",
      title: `已就绪：${accountName}`,
      detail: "后台同步引擎将持续增量更新并监听新邮件",
    });
  };

  return (
    <ModalShell
      heading="连接完成与首次同步"
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
            后台继续运行
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={enterInbox}
          >
            进入统一收件箱
          </button>
        </>
      }
    >
      <div className="settings-card">
        <div className="row-between">
          <strong style={{ fontSize: 15, color: "var(--text-ink)" }}>
            {matchesLive && live?.stage ? live.stage : info.title}
          </strong>
          <span className={`pill ${info.tone}`}>
            {matchesLive ? `${pct}%` : info.badge}
          </span>
        </div>
        <div className="storage-bar">
          <div
            style={{
              width: `${Math.max(8, Math.min(100, pct))}%`,
              background:
                resolvedStage === "failed"
                  ? "var(--status-danger)"
                  : resolvedStage === "done"
                    ? "var(--status-success)"
                    : "var(--brand-accent)",
              transition: "width 0.25s ease",
            }}
          />
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          {matchesLive && live && live.total > 0
            ? `已处理 ${live.current} / ${live.total} 封邮件，列表与全文索引正在增量刷新…`
            : info.desc}
        </div>
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          <Icon name="shield" size={14} />
          <span>凭据已加密写入本地 DPAPI 凭据盒 · 默认同步最近 90 天邮件</span>
        </div>
      </div>
    </ModalShell>
  );
}
