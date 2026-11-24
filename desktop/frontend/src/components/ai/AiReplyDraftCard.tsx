import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { DraftTarget, DraftTone } from "../../types/mailAi";
import type { AiMailInsight } from "../../types/workspace";
import {
  getLanguageLabel,
  isLanguage,
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
  const { lang, isEn, t } = useI18n();
  const { composeStore, toastStore, requestAiAction } = useApp();
  const [choice, setChoice] = useState<DraftTarget>();
  const uiTarget: DraftTarget = isEn ? "en" : "zh-CN";
  const showDualLangs = Boolean(
    foreignLanguage &&
    (isEn ? foreignLanguage !== "en" : foreignLanguage !== "zh-CN"),
  );
  const cachedTarget = insight?.draftTargetLanguage || "original";
  const targetLanguage: DraftTarget = showDualLangs
    ? (choice ?? (cachedTarget === uiTarget ? cachedTarget : "original"))
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
      title: t("toasts.insertedQuickReplyTitle"),
      detail: t("toasts.insertedQuickReplyDetail"),
    });
  };
  const draftLang =
    foreignLanguage && isLanguage(insight?.draftLanguage)
      ? insight.draftLanguage
      : undefined;
  const isForeignDraft = Boolean(
    draftLang && (isEn ? draftLang !== "en" : !draftLang.startsWith("zh")),
  );
  const insertLabel =
    isForeignDraft && draftLang
      ? t("ai.insertLangDraft", { lang: getLanguageLabel(draftLang, lang) })
      : t("ai.insertReply");
  const headingLabel = t("ai.smartReplyDraft");
  const changeToneLabel = t("ai.changeTone");
  const generateDraftLabel = t("ai.generateReplyDraft");

  return (
    <section className="ai-card ai-card-tinted" aria-label={headingLabel}>
      <div className="ai-card-head ai-draft-head">
        <span>{headingLabel}</span>
        {showDualLangs && foreignLanguage && (
          <div
            className="ai-draft-language"
            role="group"
            aria-label={t("ai.draftLanguageGroupAria")}
          >
            {(
              [
                [
                  "original",
                  t("ai.originalWithCode", {
                    code: languageCode(foreignLanguage),
                  }),
                ],
                isEn ? ["en", t("ai.inEnglish")] : ["zh-CN", t("ai.inChinese")],
              ] satisfies ReadonlyArray<readonly [DraftTarget, string]>
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
              {insertLabel}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() =>
                generate(
                  changeToneLabel,
                  insight?.draftTone === "formal" ? "friendly" : "formal",
                )
              }
            >
              {changeToneLabel}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ai-card-text">{t("ai.draftIntro")}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => generate(generateDraftLabel, "formal")}
          >
            {generateDraftLabel}
          </button>
        </>
      )}
    </section>
  );
}
