import { useI18n } from "../../i18n";
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
  const { isEn, t: tr } = useI18n();
  const { requestAiAction, workspace, mailStore } = useApp();
  const t = useTranslation();
  const ui = isEn ? "en" : "zh-CN";
  const storedSource = insight?.sourceLanguage ?? "";
  const source =
    t.confirmedSource !== "auto"
      ? t.confirmedSource
      : isLanguage(storedSource)
        ? storedSource
        : undefined;
  const detected = source ?? t.language;
  const foreign =
    detected !== "auto" &&
    (isEn ? detected !== "en" : !detected.startsWith("zh"));
  const questions = foreign
    ? [
        [tr("ai.quickReleaseNotesLabel"), tr("ai.quickReleaseNotesPrompt")],
        [tr("ai.quickExplainTermsLabel"), tr("ai.quickExplainTermsPrompt")],
      ]
    : [[tr("ai.quickExtractTodosLabel"), tr("ai.quickExtractTodosPrompt")]];

  return (
    <>
      <AiSummaryCard
        insight={insight}
        busy={busy}
        uiLanguage={ui}
        source={source ?? "auto"}
        foreignLanguage={foreign ? detected : undefined}
      />
      <AiReplyDraftCard
        key={`${workspace.activeProfileId}:${mailStore.selectedMail?.id}`}
        insight={insight}
        busy={busy}
        source={source ?? "auto"}
        foreignLanguage={foreign ? detected : undefined}
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
