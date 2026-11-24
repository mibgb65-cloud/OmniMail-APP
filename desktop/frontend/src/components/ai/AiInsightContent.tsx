import { useApp } from "../../state/AppContext";
import type { AiChatTurn, AiMailInsight } from "../../types/workspace";
import { useTranslation } from "../mail/translation/TranslationContext";
import { isLanguage } from "../mail/translation/translationLanguages";
import { AiMarkdown } from "./AiMarkdown";
import { AiSummaryCard } from "./AiSummaryCard";
import { AiReplyDraftCard } from "./AiReplyDraftCard";

export function AiInsightContent({
  insight,
  chats,
  busy,
}: {
  insight: AiMailInsight | null;
  chats: AiChatTurn[];
  busy: boolean;
}) {
  const { requestAiAction, workspace, mailStore } = useApp();
  const t = useTranslation();
  const ui = workspace.settings.language === "en-US" ? "en" : "zh-CN";
  const storedSource = insight?.sourceLanguage ?? "";
  const source =
    t.confirmedSource !== "auto"
      ? t.confirmedSource
      : isLanguage(storedSource)
        ? storedSource
        : undefined;
  const language = source ?? t.language;
  const foreign =
    language !== "auto" &&
    language !== ui &&
    !(language === "zh-TW" && ui === "zh-CN");
  const questions = foreign
    ? [
        [
          "生成发布说明",
          "请从原文提取版本、变更与风险；若与发布无关，请说明。",
        ],
        [
          "解释专业术语",
          "请用界面语言解释原文中的重要术语，并引用对应原文短语。",
        ],
      ]
    : [
        [
          "提炼待办事项",
          "请从原文提炼待办事项、负责人和截止时间；未说明时请标明。",
        ],
      ];

  return (
    <>
      <AiSummaryCard
        insight={insight}
        busy={busy}
        uiLanguage={ui}
        source={source ?? "auto"}
        foreignLanguage={foreign ? language : undefined}
      />
      <AiReplyDraftCard
        key={`${workspace.activeProfileId}:${mailStore.selectedMail?.id}`}
        insight={insight}
        busy={busy}
        source={source ?? "auto"}
        foreignLanguage={foreign ? language : undefined}
      />
      <div className="ai-quick-actions">
        {questions.map(([label, question]) => (
          <button
            key={label}
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => requestAiAction(label, { kind: "chat", question })}
          >
            {label}
          </button>
        ))}
      </div>
      {chats.map((turn) => (
        <div key={turn.id} className={`ai-chat-bubble ${turn.role}`}>
          {turn.role === "assistant" ? (
            <AiMarkdown text={turn.content} />
          ) : (
            turn.content
          )}
        </div>
      ))}
    </>
  );
}
