import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { ModalShell } from "../common/ModalShell";

export function AttachmentTransferModal({
  mode,
}: {
  mode: "transfer" | "oversized";
}) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();
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
        mode === "oversized"
          ? t("overlays.attOversizedHeading")
          : t("overlays.attTransferHeading")
      }
      subtitle={t("overlays.attTransferSubtitle")}
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("overlays.attMaxSendLimitHint")}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            {t("common.done")}
          </button>
        </>
      }
    >
      {list.length === 0 && (
        <div className="settings-card text-xs text-muted">
          {t("overlays.attNoTransferTasks")}
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
                {att.status === "ready"
                  ? t("overlays.attReadyBadge")
                  : `${pct}%`}
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
                          title: t("toasts.downloadFailed"),
                          detail: parseBackendError(e).message,
                        }),
                      )
                  }
                >
                  {t("overlays.attConfirmDownloadBtn")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </ModalShell>
  );
}
