import { t, useI18n, zhCN } from "../../i18n";
import {
  formatFileBytes,
  MAX_TOTAL_ATTACHMENTS_BYTES,
} from "../../services/composeMediaApi";
import { useApp } from "../../state/AppContext";
import type { ComposeDraftState } from "../../types/settings";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

const WARN_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

export function buildDemoDraftAttachment(
  simulateFailure = false,
): ComposeDraftState["attachments"][number] {
  const id = `att-${Date.now()}`;
  return simulateFailure
    ? {
        id,
        name: "OmniMail-设计走查录屏-28MB.mp4",
        sizeBytes: 29779558,
        sizeText: "28.4 MB",
        status: "failed",
        error: t("compose.demoFailedAttError"),
      }
    : {
        id,
        name: "OmniMail-评审议程-v2.pdf",
        sizeBytes: 1468006,
        sizeText: "1.4 MB",
        status: "ready",
      };
}

export function ComposeAttachmentsBar() {
  const { composeStore } = useApp();
  const { isEn, t: tr } = useI18n();
  const draft = composeStore.draft;
  if (!draft || draft.attachments.length === 0) return null;

  const totalBytes = draft.attachments.reduce(
    (sum, att) => sum + (att.sizeBytes ?? 0),
    0,
  );
  const isOver = totalBytes > MAX_TOTAL_ATTACHMENTS_BYTES;
  const isWarn = !isOver && totalBytes >= WARN_ATTACHMENTS_BYTES;
  const usedLabel = formatFileBytes(totalBytes);
  const quotaClass = isOver
    ? "compose-att-quota over"
    : isWarn
      ? "compose-att-quota warn"
      : "compose-att-quota";

  return (
    <div className="compose-att-bar">
      <div className="compose-att-list">
        {draft.attachments.map((att) => {
          const errorLabel =
            att.error === zhCN.compose.demoFailedAttError
              ? tr("compose.demoFailedAttError")
              : att.error;
          return (
            <Tooltip key={att.id} label={errorLabel} placement="top">
              <div
                className={`pill ${att.status === "failed" ? "pill-danger" : "pill-neutral"}`}
                style={{
                  padding: "4px 10px",
                  height: "auto",
                  maxWidth: "100%",
                }}
              >
                <Icon name="paperclip" size={12} />
                <span className="truncate">
                  {isEn
                    ? `${att.name} (${att.sizeText})`
                    : `${att.name}（${att.sizeText}）`}
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
                                sizeBytes: 11744051,
                                sizeText: "11.2 MB",
                                error: undefined,
                              }
                            : item,
                        ),
                      })
                    }
                  >
                    {tr("compose.compressAndRetry")}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={tr("compose.removeAttachmentAria", {
                    name: att.name,
                  })}
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
          );
        })}
      </div>
      <div className={quotaClass} role="status" aria-live="polite">
        {isOver
          ? tr("compose.attachmentQuotaOver", { used: usedLabel })
          : tr("compose.attachmentQuotaLabel", { used: usedLabel })}
      </div>
    </div>
  );
}
