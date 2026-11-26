import { useLayoutEffect, useRef } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { countInlineAiChars, type InlineAiPhase } from "./composeInlineAiLogic";

interface ComposeInlineAiPreviewProps {
  phase: Exclude<InlineAiPhase, "idle">;
  preview: string;
  stopped: boolean;
  canRegenerate: boolean;
  onReplace: () => void;
  onAppend: () => void;
  onRegenerate: () => void;
  onDiscard: () => void;
}

export function ComposeInlineAiPreview({
  phase,
  preview,
  stopped,
  canRegenerate,
  onReplace,
  onAppend,
  onRegenerate,
  onDiscard,
}: ComposeInlineAiPreviewProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const prevBusyRef = useRef(false);

  useLayoutEffect(() => {
    const isBusy = phase === "warmup" || phase === "streaming";
    if (isBusy && !prevBusyRef.current) {
      autoFollowRef.current = true;
    }
    prevBusyRef.current = isBusy;

    const el = viewportRef.current;
    if (el && phase === "streaming" && autoFollowRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [phase, preview]);

  if (phase === "warmup") {
    return (
      <div
        className="cia-preview-shell is-warmup"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="cia-preview-inner">
          <div className="cia-preview-head">
            <span className="cia-thinking-row">
              <span className="cia-stagger-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{t("compose.thinkingStatus")}</span>
            </span>
          </div>
          <div className="cia-skeleton-box" aria-hidden="true">
            <div className="cia-skeleton-line w-92" />
            <div className="cia-skeleton-line w-78" />
            <div className="cia-skeleton-line w-54" />
          </div>
        </div>
      </div>
    );
  }

  const charCount = countInlineAiChars(preview);
  const isStreaming = phase === "streaming";

  return (
    <div
      className={`cia-preview-shell ${isStreaming ? "is-streaming" : "is-completed"}`}
      aria-live="polite"
      aria-busy={isStreaming ? "true" : undefined}
    >
      <div className="cia-preview-inner">
        <div className="cia-preview-head">
          <div className="cia-preview-head-left">
            {isStreaming ? (
              <>
                <span className="cia-draft-pill">
                  <i className="cia-dot-pulse" aria-hidden="true" />
                  <span>{t("compose.previewDraftPill")}</span>
                </span>
                <span className="cia-preview-hint">
                  {t("compose.previewSafeHint")}
                </span>
              </>
            ) : (
              <>
                <span
                  className={`cia-done-pill${stopped ? " is-stopped" : ""}`}
                >
                  <Icon name="check" size={11} />
                  <span>
                    {t(
                      stopped
                        ? "compose.stoppedCountBadge"
                        : "compose.generatedCountBadge",
                      { count: charCount },
                    )}
                  </span>
                </span>
                <span className="cia-preview-hint">
                  {t("compose.continueRefineHint")}
                </span>
              </>
            )}
          </div>
          {isStreaming && (
            <span className="cia-writing-tag">
              {t("compose.writingBodyStatus")}
            </span>
          )}
        </div>

        <FadeScroll
          className="cia-preview-scroll"
          label={t("compose.previewDraftPill")}
          viewportProps={{
            ref: viewportRef,
            onScroll: () => {
              const el = viewportRef.current;
              if (el) {
                autoFollowRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
              }
            },
          }}
        >
          <div className="cia-preview-text selectable">
            {preview}
            {isStreaming && (
              <span className="cia-stream-caret" aria-hidden="true" />
            )}
          </div>
        </FadeScroll>

        {isStreaming ? (
          <div className="cia-preview-stream-foot">
            <span className="cia-esc-hint">{t("compose.escToStopHint")}</span>
          </div>
        ) : (
          <div className="cia-preview-actions">
            <div className="cia-preview-actions-left">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onReplace}
              >
                <Icon name="check" size={12} />
                <span>{t("compose.replaceCurrentBodyBtn")}</span>
              </button>
              <button
                type="button"
                className="btn btn-sm cia-append-btn"
                onClick={onAppend}
              >
                <Icon name="plus" size={12} />
                <span>{t("compose.appendToEndBtn")}</span>
              </button>
              {canRegenerate && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onRegenerate}
                >
                  <Icon name="refresh" size={12} />
                  <span>{t("compose.regenerateBtn")}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              className="cia-discard-btn"
              onClick={onDiscard}
            >
              <Icon name="x" size={12} />
              <span>{t("compose.discardAiBtn")}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
