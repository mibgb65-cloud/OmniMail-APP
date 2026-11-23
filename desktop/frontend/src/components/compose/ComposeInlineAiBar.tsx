import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { useInlineComposeAi } from "./useInlineComposeAi";

export function ComposeInlineAiBar() {
  const { workspace, composeStore, toastStore } = useApp();
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
          <Icon name="sparkle" size={14} /> 写信内联 AI 助手 ·
          仅处理当前草稿正文
        </span>
        <div className="row" style={{ gap: 6 }}>
          {busy && reqId && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={stopAssist}
            >
              停止
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => composeStore.updateDraft({ inlineAiOpen: false })}
          >
            关闭
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
          生成初稿
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("polish", "professional")}
        >
          改为更正式
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("polish", "concise")}
        >
          精简提炼
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary btn-sm"
          onClick={() => runAssist("translate_en", "professional")}
        >
          译为英文
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
          placeholder="输入自定义写作要求，回车生成…"
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
                  composeStore.updateDraft({ body: preview });
                  setPreview("");
                  toastStore.pushToast({
                    tone: "success",
                    title: "已采纳 AI 内容写入草稿正文",
                  });
                }}
              >
                采纳并覆盖正文
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreview("")}
              >
                放弃
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
