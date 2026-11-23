import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { isWailsDesktop } from "../../state/storageHelpers";
import { useApp } from "../../state/AppContext";
import { ModalShell } from "../common/ModalShell";

export function AttachmentTransferModal({
  mode,
}: {
  mode: "transfer" | "oversized";
}) {
  const { workspace, mailStore, toastStore } = useApp();
  const list = mailStore.selectedMail?.attachments ?? [];
  const [progMap, setProgMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isWailsDesktop()) return;
    return Events.On("omnimail:attachment:progress", (ev) => {
      const d = ev.data as
        { attachmentId?: string; progress?: number } | undefined;
      if (d?.attachmentId) {
        setProgMap((p) => ({ ...p, [d.attachmentId!]: d.progress ?? 0 }));
      }
    });
  }, []);

  return (
    <ModalShell
      heading={
        mode === "oversized" ? "超大附件按需下载确认" : "附件传输与本地缓存状态"
      }
      subtitle="采用 SHA-256 内容寻址去重存储，超出配额自动按 LRU 释放"
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">常规发件上限提示：25 MB</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            完成
          </button>
        </>
      }
    >
      {list.length === 0 && (
        <div className="settings-card text-xs text-muted">
          当前选中邮件没有外部附件传输任务。
        </div>
      )}
      {list.map((att) => {
        const pct = progMap[att.id] ?? (att.status === "ready" ? 100 : 0);
        return (
          <div key={att.id} className="settings-card">
            <div className="row-between">
              <strong className="truncate">{att.name}</strong>
              <span
                className={`pill ${att.status === "ready" ? "pill-success" : "pill-warning"}`}
              >
                {att.status === "ready" ? "已就绪" : `${pct}%`}
              </span>
            </div>
            <div className="storage-bar">
              <div
                style={{
                  width: `${pct}%`,
                  background: "var(--status-success)",
                }}
              />
            </div>
            <div className="row-between">
              <span className="text-xs text-muted">{att.sizeText}</span>
              {att.status !== "ready" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    void mailApi
                      .downloadAttachment(att.id)
                      .then(() => mailStore.reloadMessages())
                      .catch((e) =>
                        toastStore.pushToast({
                          tone: "danger",
                          title: "下载失败",
                          detail: parseBackendError(e).message,
                        }),
                      )
                  }
                >
                  确认下载
                </button>
              )}
            </div>
          </div>
        );
      })}
    </ModalShell>
  );
}
