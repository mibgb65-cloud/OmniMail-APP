import { useI18n } from "../../i18n";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { AttachmentItem } from "../../types/mail";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ScrollCodeBlock } from "../common/scroll-fade/FadeScroll";

export { AttachmentTransferModal } from "./AttachmentTransferModal";

export function AttachmentPreviewModal({
  attachment,
  mailSubject,
}: {
  attachment: AttachmentItem;
  mailSubject: string;
}) {
  const { workspace, toastStore } = useApp();
  const { t, localizeText } = useI18n();
  const streamUrl =
    attachment.previewUrl ||
    `/omnimail-attachment/${encodeURIComponent(attachment.id)}`;

  const handleOpenExternal = async () => {
    try {
      await mailApi.openAttachment(attachment.id);
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.openAttFailed"),
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
          title: t("toasts.savedAttAsTitle"),
          detail: dst,
        });
      }
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.saveAttAsFailed"),
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading={attachment.name}
      subtitle={t("overlays.attFromMailSub", {
        size: attachment.sizeText,
        subject: localizeText(mailSubject),
      })}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("overlays.attPreviewFooterHint")}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleOpenExternal()}
            >
              <Icon name="external" size={13} />{" "}
              {t("overlays.attOpenSystemAppBtn")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveAs()}
            >
              <Icon name="download" size={14} /> {t("overlays.attSaveAsBtn")}
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
        <ScrollCodeBlock
          maxHeight={340}
          label={t("overlays.attPreviewScrollLabel")}
        >
          {attachment.previewSummary}
        </ScrollCodeBlock>
      ) : (
        <div
          className="settings-card"
          style={{ alignItems: "center", padding: 32, textAlign: "center" }}
        >
          <Icon name="file" size={34} />
          <strong>{attachment.name}</strong>
          <div className="text-xs text-muted">
            {t("overlays.attNoInlinePreviewHint")}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
