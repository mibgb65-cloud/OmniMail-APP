import { useApp } from "../../../state/AppContext";
import type { AttachmentItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function ReaderAttachmentsSection({
  attachments,
  mailSubject,
}: {
  attachments: AttachmentItem[];
  mailSubject: string;
}) {
  const { workspace, toastStore } = useApp();

  if (attachments.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}
      >
        附件 · {attachments.length} 个文件
      </div>
      <div className="attachment-grid">
        {attachments.map((att) => (
          <div key={att.id} className="attachment-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "var(--bg-selected)",
                  color: "var(--brand-accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={att.kind === "image" ? "image" : "file"}
                  size={16}
                />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-ink)",
                  }}
                >
                  {att.name}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 12, color: "var(--text-muted)" }}
                >
                  {att.ext} · {att.sizeText}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  workspace.setOverlay({
                    type: "attachment-preview",
                    attachment: att,
                    mailSubject,
                  })
                }
              >
                <Icon name="eye" size={13} /> 预览
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-bordered"
                style={{ width: 28, height: 28 }}
                title="下载附件"
                onClick={() =>
                  toastStore.pushToast({
                    tone: "success",
                    title: `已下载 ${att.name}`,
                    detail: "已保存至本地安全下载目录",
                  })
                }
              >
                <Icon name="download" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
