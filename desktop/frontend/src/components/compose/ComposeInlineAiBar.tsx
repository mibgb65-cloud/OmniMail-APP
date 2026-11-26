import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ComposeInlineAiPreview } from "./ComposeInlineAiPreview";
import {
  buildAppendedDraftBody,
  buildReplacedDraftBody,
  countInlineAiChars,
  deriveComposeAiLockState,
  INLINE_AI_PRESETS,
  resolveInlineAiPhase,
} from "./composeInlineAiLogic";
import type { InlineComposeAiController } from "./useInlineComposeAi";

export function ComposeInlineAiBar({ ai }: { ai: InlineComposeAiController }) {
  const { composeStore, toastStore } = useApp();
  const { t } = useI18n();
  const draft = composeStore.draft;
  const [promptBox, setPromptBox] = useState({ scopeId: "", text: "" });

  if (!draft || !draft.inlineAiOpen) return null;

  const prompt = promptBox.scopeId === draft.id ? promptBox.text : "";
  const setPrompt = (text: string) => setPromptBox({ scopeId: draft.id, text });

  const { busy, preview, stopped, activePreset, canRegenerate } = ai;
  const lock = deriveComposeAiLockState(busy, activePreset);
  const phase = resolveInlineAiPhase(busy, preview);
  const streamCount = countInlineAiChars(preview);

  const submitPrompt = () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    ai.runAssist("draft", "professional", trimmed, "custom");
  };

  const handleCloseBar = () => {
    ai.clearPreview();
    composeStore.updateDraft({ inlineAiOpen: false });
  };

  const handleReplace = () => {
    const next = buildReplacedDraftBody(preview);
    composeStore.updateDraft(next);
    ai.clearPreview();
    setPrompt("");
    toastStore.pushToast({ tone: "success", title: t("toasts.adoptedAiBody") });
  };

  const handleAppend = () => {
    const next = buildAppendedDraftBody(draft.body, draft.bodyHtml, preview);
    composeStore.updateDraft(next);
    ai.clearPreview();
    setPrompt("");
    toastStore.pushToast({
      tone: "success",
      title: t("compose.appendedAiBodyToast"),
    });
  };

  return (
    <div className={`cia-bar${busy ? " is-busy" : ""}`}>
      <div
        className={`cia-aurora-track${busy ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <div className="cia-aurora-beam" />
      </div>

      <div className="cia-body">
        <div className="cia-top-row">
          <div className="cia-title-group">
            <span className="cia-ai-mark" aria-hidden="true">
              AI
            </span>
            <span className="cia-banner-title">
              {t("compose.inlineAiBanner")}
            </span>
            {busy && (
              <span className="cia-live-pill">
                <span className="cia-stagger-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {phase === "streaming"
                    ? t("compose.streamingCountStatus", { count: streamCount })
                    : t("compose.thinkingStatus")}
                </span>
              </span>
            )}
          </div>

          <div className="cia-top-actions">
            {busy && (
              <button
                type="button"
                className="cia-stop-btn"
                onClick={ai.stopAssist}
              >
                <span className="cia-stop-square" aria-hidden="true" />
                <span>{t("compose.stopGeneratingBtn")}</span>
                <kbd className="cia-stop-esc">Esc</kbd>
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCloseBar}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="cia-controls-row">
          {INLINE_AI_PRESETS.map((preset) => {
            const isActive = lock.highlightedPreset === preset.id;
            const isDimmed = busy && !isActive;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={lock.presetsDisabled}
                className={`btn btn-secondary btn-sm cia-preset-btn${isActive ? " is-active-run" : ""}${isDimmed ? " is-dimmed" : ""}`}
                onClick={() =>
                  ai.runAssist(preset.action, preset.tone, "", preset.id)
                }
              >
                {isActive && (
                  <span className="cia-dot-pulse" aria-hidden="true" />
                )}
                <span>{t(preset.labelKey)}</span>
              </button>
            );
          })}

          <div className={`cia-prompt-wrap${busy ? " is-locked" : ""}`}>
            {lock.highlightedPreset === "custom" && (
              <span className="cia-dot-pulse" aria-hidden="true" />
            )}
            <input
              type="text"
              className="cia-prompt-input"
              disabled={lock.promptDisabled}
              aria-busy={busy ? "true" : undefined}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={(e) => {
                if (!busy && preview) e.currentTarget.select();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy && prompt.trim()) {
                  e.preventDefault();
                  submitPrompt();
                }
              }}
              placeholder={t("compose.customPromptPlaceholder")}
            />
            {busy ? (
              <span className="cia-locked-pill">
                {t("compose.inputLockedPill")}
              </span>
            ) : (
              <button
                type="button"
                className="cia-send-prompt-btn"
                disabled={!prompt.trim()}
                aria-label={t("compose.sendPromptAria")}
                onClick={submitPrompt}
              >
                <Icon name="arrowUp" size={13} />
              </button>
            )}
          </div>
        </div>

        {phase !== "idle" && (
          <ComposeInlineAiPreview
            phase={phase}
            preview={preview}
            stopped={stopped}
            canRegenerate={canRegenerate}
            onReplace={handleReplace}
            onAppend={handleAppend}
            onRegenerate={ai.regenerate}
            onDiscard={ai.clearPreview}
          />
        )}
      </div>
    </div>
  );
}
