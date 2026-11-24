import { useI18n } from "../../../i18n";
import type { AttachmentItem } from "../../../types/mail";
import { AsyncStateGlyph } from "../../common/AsyncStateGlyph";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";

export type AttPhase = "idle" | "downloading" | "just-ready" | "error";

export function AttachmentCardRow({
  att,
  phase,
  progress,
  onPreview,
  onSaveAs,
}: {
  att: AttachmentItem;
  phase: AttPhase;
  progress?: number;
  onPreview: () => void;
  onSaveAs: () => void;
}) {
  const { t } = useI18n();
  const subText =
    phase === "downloading"
      ? progress && progress > 0
        ? t("reader.attDownloadingPct", { size: att.sizeText, pct: progress })
        : t("reader.attFetchingCache", { size: att.sizeText })
      : phase === "just-ready"
        ? t("reader.attCachedReady", { size: att.sizeText })
        : `${att.ext} · ${att.sizeText}${att.status === "remote" ? t("reader.attOnDemandSuffix") : ""}`;

  return (
    <div className="attachment-card" data-att-phase={phase}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "var(--bg-selected)",
            color:
              phase === "just-ready"
                ? "var(--status-success)"
                : "var(--brand-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {phase === "downloading" ? (
            <AsyncStateGlyph status="loading" progress={progress} size={17} />
          ) : phase === "just-ready" ? (
            <AsyncStateGlyph status="success" size={17} />
          ) : (
            <Icon name={att.kind === "image" ? "image" : "file"} size={16} />
          )}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--text-ink)" }}
          >
            {att.name}
          </div>
          <div
            className={`truncate ${phase === "just-ready" ? "att-ready-pill" : ""}`}
            style={{
              fontSize: 12,
              color: phase === "just-ready" ? undefined : "var(--text-muted)",
            }}
          >
            {subText}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          aria-busy={phase === "downloading" ? "true" : undefined}
          className="btn btn-sm btn-secondary"
          onClick={onPreview}
        >
          {phase === "downloading" ? (
            <>
              <AsyncStateGlyph status="loading" progress={progress} size={13} />
              <span>
                {progress && progress > 0
                  ? `${progress}%`
                  : t("reader.attPulling")}
              </span>
            </>
          ) : phase === "just-ready" ? (
            <>
              <AsyncStateGlyph status="success" size={13} />
              <span>{t("reader.attCachedBtn")}</span>
            </>
          ) : (
            <>
              <Icon name="eye" size={13} /> {t("reader.attPreviewBtn")}
            </>
          )}
        </button>
        <Tooltip label={t("reader.attSaveToLocalTip")} placement="top">
          <button
            type="button"
            className="icon-btn icon-btn-bordered"
            style={{ width: 28, height: 28 }}
            aria-label={t("reader.attSaveAria", { name: att.name })}
            onClick={onSaveAs}
          >
            <Icon name="download" size={13} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
