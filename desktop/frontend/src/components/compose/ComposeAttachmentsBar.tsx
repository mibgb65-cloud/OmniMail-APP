import { useApp } from "../../state/AppContext";
import type { ComposeDraftState } from "../../types/settings";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

export function buildDemoDraftAttachment(
  simulateFailure = false,
): ComposeDraftState["attachments"][number] {
  const id = `att-${Date.now()}`;
  return simulateFailure
    ? {
        id,
        name: "OmniMail-设计走查录屏-28MB.mp4",
        sizeText: "28.4 MB",
        status: "failed",
        error: "超过单封附件限制 25 MB，请压缩或改用链接",
      }
    : {
        id,
        name: "OmniMail-评审议程-v2.pdf",
        sizeText: "1.4 MB",
        status: "ready",
      };
}

export function ComposeAttachmentsBar() {
  const { composeStore } = useApp();
  const draft = composeStore.draft;
  if (!draft || draft.attachments.length === 0) return null;

  return (
    <div
      style={{
        padding: "8px 20px",
        borderTop: "1px solid var(--border-default)",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {draft.attachments.map((att) => (
        <Tooltip key={att.id} label={att.error} placement="top">
          <div
            className={`pill ${att.status === "failed" ? "pill-danger" : "pill-neutral"}`}
            style={{ padding: "4px 10px", height: "auto", maxWidth: "100%" }}
          >
            <Icon name="paperclip" size={12} />
            <span className="truncate">
              {att.name}（{att.sizeText}）
            </span>
            {att.status === "failed" && (
              <button
                type="button"
                style={{ textDecoration: "underline", fontWeight: 600 }}
                onClick={() =>
                  composeStore.updateDraft({
                    attachments: draft.attachments.map((item) =>
                      item.id === att.id
                        ? {
                            ...item,
                            status: "ready",
                            sizeText: "11.2 MB",
                            error: undefined,
                          }
                        : item,
                    ),
                  })
                }
              >
                压缩重试
              </button>
            )}
            <button
              type="button"
              aria-label={`移除附件 ${att.name}`}
              onClick={() =>
                composeStore.updateDraft({
                  attachments: draft.attachments.filter(
                    (item) => item.id !== att.id,
                  ),
                })
              }
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
