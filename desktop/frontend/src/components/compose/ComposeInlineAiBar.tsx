import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function ComposeInlineAiBar() {
  const { composeStore, toastStore } = useApp();
  const draft = composeStore.draft;
  const [prompt, setPrompt] = useState("");
  if (!draft || !draft.inlineAiOpen) return null;

  const applyRewrite = (mode: "draft" | "formal" | "concise" | "en") => {
    const map: Record<typeof mode, string> = {
      draft: `你好：\n\n关于「${draft.subject || "本次协作事宜"}」，我已整理好核心进度与确认项，预计于明日中午前同步完整版本。如有需要补充的边界细节，欢迎随时告知。\n\n此致，\n陆星河`,
      formal: `尊敬的合作方：\n\n${draft.body || "感谢来信沟通相关进展。"}我们已核对所有关键节点，并将在约定时间前完成书面确认。如您对上述安排有任何建议，敬请随时回复。\n\n顺颂商祺，\n陆星河`,
      concise: `已确认「${draft.subject || "相关事项"}」当前进度，明日中午前给出最终确认意见。`,
      en: `Hi team,\n\nThanks for the update regarding "${draft.subject || "the project milestone"}". I have reviewed the latest details and will share final confirmation before noon tomorrow.\n\nBest regards,\nXinghe Lu`,
    };
    composeStore.updateDraft({ body: map[mode] });
    toastStore.pushToast({
      tone: "success",
      title: "已应用 Omni AI 写作改写",
      detail: "仅修改草稿正文，发送前请人工确认",
    });
  };

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
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => composeStore.updateDraft({ inlineAiOpen: false })}
        >
          关闭
        </button>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => applyRewrite("draft")}
        >
          生成初稿
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => applyRewrite("formal")}
        >
          改为更正式
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => applyRewrite("concise")}
        >
          精简提炼
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => applyRewrite("en")}
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
            if (e.key === "Enter" && prompt.trim()) {
              applyRewrite("draft");
              setPrompt("");
            }
          }}
          placeholder="输入自定义写作要求，如“补充会议纪要要点”…"
        />
      </div>
    </div>
  );
}
