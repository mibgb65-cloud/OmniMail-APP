import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { mailApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import { isWailsDesktop } from "../../../state/storageHelpers";
import type { AttachmentItem } from "../../../types/mail";
import { waitSuccessHold } from "../../common/AsyncStateGlyph";
import { AttachmentCardRow, type AttPhase } from "./AttachmentCardRow";

export function ReaderAttachmentsSection({
  attachments,
  mailSubject,
}: {
  attachments: AttachmentItem[];
  mailSubject: string;
}) {
  const { workspace, mailStore, toastStore } = useApp();
  const [phases, setPhases] = useState<Record<string, AttPhase>>({});
  const [progMap, setProgMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isWailsDesktop()) return;
    return Events.On("omnimail:attachment:progress", (ev) => {
      const d = ev.data as
        { attachmentId?: string; progress?: number } | undefined;
      if (d?.attachmentId) {
        setProgMap((prev) => ({
          ...prev,
          [d.attachmentId!]: d.progress ?? 0,
        }));
      }
    });
  }, []);

  if (attachments.length === 0) return null;

  const setAttPhase = (id: string, next: AttPhase) => {
    setPhases((prev) => ({ ...prev, [id]: next }));
  };

  const handlePreview = async (att: AttachmentItem) => {
    if (att.status === "oversized") {
      workspace.setOverlay({ type: "attachment-transfer", mode: "oversized" });
      return;
    }
    if (phases[att.id] === "downloading") return;

    let readyAtt = att;
    if (att.status !== "ready") {
      setAttPhase(att.id, "downloading");
      try {
        readyAtt = await mailApi.downloadAttachment(att.id);
        void mailStore.reloadMessages();
        setAttPhase(att.id, "just-ready");
        await waitSuccessHold(650);
        setAttPhase(att.id, "idle");
      } catch (err) {
        setAttPhase(att.id, "error");
        toastStore.pushToast({
          tone: "danger",
          title: "拉取附件失败",
          detail: parseBackendError(err).message,
        });
        return;
      }
    }
    workspace.setOverlay({
      type: "attachment-preview",
      attachment: readyAtt,
      mailSubject,
    });
  };

  const handleSaveAs = async (att: AttachmentItem) => {
    if (phases[att.id] === "downloading") return;
    setAttPhase(att.id, "downloading");
    try {
      const savedPath = await mailApi.saveAttachmentAs(att.id);
      if (!savedPath) {
        setAttPhase(att.id, "idle");
        return;
      }
      setAttPhase(att.id, "just-ready");
      toastStore.pushToast({
        tone: "success",
        title: `已保存附件：${att.name}`,
        detail: savedPath,
      });
      await waitSuccessHold(950);
      setAttPhase(att.id, "idle");
    } catch (err) {
      setAttPhase(att.id, "error");
      toastStore.pushToast({
        tone: "danger",
        title: "保存附件失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}
      >
        附件 · {attachments.length} 个文件
      </div>
      <div className="attachment-grid">
        {attachments.map((att) => (
          <AttachmentCardRow
            key={att.id}
            att={att}
            phase={phases[att.id] ?? "idle"}
            progress={progMap[att.id]}
            onPreview={() => void handlePreview(att)}
            onSaveAs={() => void handleSaveAs(att)}
          />
        ))}
      </div>
    </div>
  );
}
