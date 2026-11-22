import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import {
  ALL_SYNC_STAGES,
  SYNC_STAGE_INFO,
  type SyncStage,
} from "./syncStageMeta";

export function SyncProgressModal({
  accountName,
  stage,
}: {
  accountName: string;
  stage: SyncStage;
}) {
  const { workspace, toastStore } = useApp();
  const info = SYNC_STAGE_INFO[stage];

  const finishAndEnter = () => {
    const newId = `acc-new-${Date.now()}`;
    const email = `new.${workspace.accounts.length + 1}@mail.example`;
    workspace.addAccount({
      id: newId,
      name: accountName.slice(0, 14),
      shortTag: accountName.slice(0, 10),
      email,
      provider: "imap",
      providerLabel: "手动 IMAP / SMTP",
      authMode: "imap",
      status: stage === "partial" ? "syncing" : "connected",
      unreadCount: 3,
      lastSyncedAt: "刚刚",
      senderName: "陆星河",
      replyTo: email,
      signature: "陆星河\n通过 OmniMail 桌面工作空间发送",
      imap: { host: "imap.mail.example", port: 993, security: "SSL/TLS" },
      smtp: { host: "smtp.mail.example", port: 465, security: "SSL/TLS" },
      imapIdle: true,
      offlineWindowDays: 90,
      indexedEmails: 240,
      storageMb: 128,
      attachmentCacheMb: 36,
    });
    workspace.setOverlay({ type: "none" });
    workspace.setScreen("mail");
    toastStore.pushToast({
      tone: "success",
      title: `已接入新邮箱：${accountName}`,
      detail: "已加入统一收件箱并开启增量同步",
    });
  };

  return (
    <ModalShell
      title="连接测试与首次同步"
      subtitle={accountName}
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            {ALL_SYNC_STAGES.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`btn btn-sm ${stage === st.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() =>
                  workspace.setOverlay({
                    type: "sync-progress",
                    accountName,
                    stage: st.id,
                  })
                }
              >
                {st.label}
              </button>
            ))}
          </div>
          {stage === "done" || stage === "partial" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={finishAndEnter}
            >
              进入统一收件箱
            </button>
          ) : stage === "failed" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                workspace.setOverlay({
                  type: "sync-progress",
                  accountName,
                  stage: "testing",
                })
              }
            >
              重新测试
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                workspace.setOverlay({
                  type: "sync-progress",
                  accountName,
                  stage:
                    stage === "testing"
                      ? "connected"
                      : stage === "connected"
                        ? "syncing"
                        : "done",
                })
              }
            >
              下一步
            </button>
          )}
        </>
      }
    >
      <div className="settings-card">
        <div className="row-between">
          <strong style={{ fontSize: 15, color: "var(--text-ink)" }}>
            {info.title}
          </strong>
          <span className={`pill ${info.tone}`}>{info.badge}</span>
        </div>
        <div className="storage-bar">
          <div
            style={{
              width: `${info.progress}%`,
              background:
                stage === "failed"
                  ? "var(--status-danger)"
                  : stage === "partial"
                    ? "var(--status-warning)"
                    : stage === "done" || stage === "connected"
                      ? "var(--status-success)"
                      : "var(--brand-accent)",
              transition: "width 0.25s ease",
            }}
          />
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          {info.desc}
        </div>
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          <Icon name="shield" size={14} />
          <span>凭据加密写入系统钥匙串 · 同步范围默认最近 90 天邮件</span>
        </div>
      </div>
    </ModalShell>
  );
}
