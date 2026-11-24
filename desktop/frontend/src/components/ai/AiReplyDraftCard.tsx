import { useState } from "react";
import { useApp } from "../../state/AppContext";
import type { DraftTarget, DraftTone } from "../../types/mailAi";
import type { AiMailInsight } from "../../types/workspace";
import {
  languageCode,
  type SourceLanguage,
} from "../mail/translation/translationLanguages";

export function AiReplyDraftCard({
  insight,
  busy,
  source,
  foreignLanguage,
}: {
  insight: AiMailInsight | null;
  busy: boolean;
  source: SourceLanguage;
  foreignLanguage?: SourceLanguage;
}) {
  const { composeStore, toastStore, requestAiAction } = useApp();
  const [choice, setChoice] = useState<DraftTarget>();
  const cachedTarget = insight?.draftTargetLanguage || "original";
  const targetLanguage = foreignLanguage
    ? (choice ?? (cachedTarget === "zh-CN" ? cachedTarget : "original"))
    : "original";
  const draft =
    cachedTarget === targetLanguage ? (insight?.draftReply.trim() ?? "") : "";
  const generate = (label: string, tone: DraftTone) =>
    requestAiAction(label, {
      kind: "draft",
      sourceLanguage: source,
      targetLanguage,
      tone,
    });
  const insert = () => {
    composeStore.setQuickReplyText(draft);
    toastStore.pushToast({
      tone: "success",
      title: "已插入底部快速回复框",
      detail: "请人工核对收件账户与正文内容后再发送",
    });
  };

  return (
    <section className="ai-card ai-card-tinted" aria-label="智能拟稿回复">
      <div className="ai-card-head ai-draft-head">
        <span>智能拟稿回复</span>
        {foreignLanguage && (
          <div className="ai-draft-language" role="group" aria-label="草稿语言">
            {(
              [
                ["original", `原文 (${languageCode(foreignLanguage)})`],
                ["zh-CN", "用中文"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                aria-pressed={targetLanguage === value}
                onClick={() => setChoice(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {draft ? (
        <>
          <p className="ai-card-text ai-draft-text">{draft}</p>
          <div className="row ai-draft-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={insert}
            >
              {insight?.draftLanguage === "en" && foreignLanguage
                ? "插入英文草稿"
                : "插入回复框"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() =>
                generate(
                  "换个语气",
                  insight?.draftTone === "formal" ? "friendly" : "formal",
                )
              }
            >
              换个语气
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ai-card-text">
            独立按需触发，绝不自动生成。需要回复时再点击起草。
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => generate("生成回复草稿", "formal")}
          >
            生成回复草稿
          </button>
        </>
      )}
    </section>
  );
}
