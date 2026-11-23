import { useApp } from "../../state/AppContext";
import type { LiveSyncProgress } from "../../state/syncProgress";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

const badgeByStatus: Record<LiveSyncProgress["status"] | "waiting", string[]> =
  {
    waiting: ["等待同步", "pill-accent"],
    syncing: ["首次同步中", "pill-accent"],
    done: ["同步完成", "pill-success"],
    partial: ["部分同步失败", "pill-warning"],
    failed: ["同步失败", "pill-danger"],
  };

export function SyncProgressModal({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const { workspace, desktopBridge } = useApp();
  const live = desktopBridge.syncProgressByAccount.get(accountId);
  const [badge, tone] = badgeByStatus[live?.status ?? "waiting"];
  const inbox = live?.status === "syncing" && live.total > 0 ? live : null;

  const enterInbox = () => {
    workspace.setOverlay({ type: "none" });
    workspace.setScreen("mail");
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
      <div className="settings-card" role="status">
        <div className="row-between">
          <strong style={{ fontSize: 15, color: "var(--text-ink)" }}>
            {live?.stage || "首次同步即将开始"}
          </strong>
          <span className={`pill ${tone}`}>{badge}</span>
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
            ? `已处理 ${inbox.current} / ${inbox.total} 封待同步的收件箱邮件`
            : live?.status === "failed" || live?.status === "partial"
              ? "可进入收件箱查看已下载的邮件，或稍后手动重试同步。"
              : "附件按需下载，不影响阅读。"}
        </div>
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          <Icon name="shield" size={14} />
          <span>凭据已加密写入本地 DPAPI 凭据盒</span>
        </div>
      </div>
    </ModalShell>
  );
}
