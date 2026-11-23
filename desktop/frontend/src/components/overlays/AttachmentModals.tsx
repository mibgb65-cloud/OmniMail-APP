import { mailApi, parseBackendError } from "../../services/backendClient";
import { isWailsDesktop } from "../../state/storageHelpers";
import { useApp } from "../../state/AppContext";
import type { AttachmentItem } from "../../types/mail";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export { AttachmentTransferModal } from "./AttachmentTransferModal";

export function AttachmentPreviewModal({
  attachment,
  mailSubject,
}: {
  attachment: AttachmentItem;
  mailSubject: string;
}) {
  const { workspace, toastStore } = useApp();
  const streamUrl =
    attachment.previewUrl ||
    `/omnimail-attachment/${encodeURIComponent(attachment.id)}`;

  const handleOpenExternal = async () => {
    try {
      await mailApi.openAttachment(attachment.id);
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: "打开附件失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  const handleSaveAs = async () => {
    try {
      const dst = await mailApi.saveAttachmentAs(attachment.id);
      if (dst) {
        toastStore.pushToast({
          tone: "success",
          title: "已另存附件",
          detail: dst,
        });
      }
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: "另存附件失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={attachment.name}
      subtitle={`${attachment.sizeText} · 来自《${mailSubject}》`}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            本地受控流只读预览 · 默认不向 AI 发送附件内容
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleOpenExternal()}
            >
              <Icon name="external" size={13} /> 用系统应用打开
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveAs()}
            >
              <Icon name="download" size={14} /> 另存为…
            </button>
          </div>
        </>
      }
    >
      {attachment.kind === "image" && isWailsDesktop() ? (
        <div
          className="settings-card"
          style={{ alignItems: "center", padding: 16 }}
        >
          <img
            src={streamUrl}
            alt={attachment.name}
            style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 8 }}
          />
        </div>
      ) : attachment.kind === "pdf" && isWailsDesktop() ? (
        <iframe
          title={attachment.name}
          src={streamUrl}
          style={{
            width: "100%",
            height: 400,
            border: "1px solid var(--border-default)",
            borderRadius: 10,
          }}
        />
      ) : attachment.previewSummary ? (
        <pre className="code-block" style={{ maxHeight: 340 }}>
          {attachment.previewSummary}
        </pre>
      ) : (
        <div
          className="settings-card"
          style={{ alignItems: "center", padding: 32, textAlign: "center" }}
        >
          <Icon name="file" size={34} />
          <strong>{attachment.name}</strong>
          <div className="text-xs text-muted">
            可点击下方「用系统应用打开」或「另存为」查看完整原件。
          </div>
        </div>
      )}
    </ModalShell>
  );
}
