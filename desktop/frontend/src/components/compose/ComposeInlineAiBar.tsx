import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { plainTextToComposeHtml } from "./composeRichHtml";
import { useInlineComposeAi } from "./useInlineComposeAi";

export function ComposeInlineAiBar() {
  const { workspace, composeStore, toastStore } = useApp();
  const { t } = useI18n();
  const draft = composeStore.draft;
  const [prompt, setPrompt] = useState("");
  const { reqId, preview, setPreview, busy, runAssist, stopAssist } =
    useInlineComposeAi(
      draft,
      () => workspace.setOverlay({ type: "settings", tab: "ai" }),
      toastStore.pushToast,
    );

  if (!draft || !draft.inlineAiOpen) return null;

  return (
    <div
      style={{
        padding: "10px 20px",
        background: "var(--bg-ai-surface)",
        borderBottom: "1px solid var(--border-ai)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="row-between">
        <span
          className="row text-xs"
          style={{ color: "var(--brand-ai)", fontWeight: 700 }}
        >
          <Icon name="sparkle" size={14} /> {t("compose.inlineAiBanner")}
        </span>
        <div className="row" style={{ gap: 6 }}>
          {busy && reqId && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={stopAssist}
            >
              {t("compose.stopBtn")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => composeStore.updateDraft({ inlineAiOpen: false })}
          >
            {t("common.close")}
          </button>
        </div>
      </div>

      <div className="row" style={{ flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("draft", "professional")}
        >
          {t("compose.generateFirstDraft")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("polish", "professional")}
        >
          {t("compose.makeFormal")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("polish", "concise")}
        >
          {t("compose.makeConcise")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("translate_en", "professional")}
        >
          {t("compose.translateToEn")}
        </button>
        <input
          type="text"
          className="input"
          style={{ height: 28, flex: 1, minWidth: 160 }}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && prompt.trim() && !busy) {
              runAssist("draft", "professional", prompt.trim());
              setPrompt("");
            }
          }}
          placeholder={t("compose.customPromptPlaceholder")}
        />
      </div>

      {preview && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          <div>{preview}</div>
          {!busy && (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  composeStore.updateDraft({
                    body: preview,
                    bodyHtml: plainTextToComposeHtml(preview),
                  });
                  setPreview("");
                  toastStore.pushToast({
                    tone: "success",
                    title: t("toasts.adoptedAiBody"),
                  });
                }}
              >
                {t("compose.adoptAndReplace")}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreview("")}
              >
                {t("compose.discardAiBtn")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
