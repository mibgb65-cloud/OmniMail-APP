import { useCallback, useState } from "react";
import { summaryAction } from "../components/ai/aiAnalysisPrompt";
import type { SourceLanguage } from "../components/mail/translation/translationLanguages";
import { hasUsableSummary } from "../components/ai/autoMailSummary";
import { AI_INSIGHTS_BY_MAIL } from "../data/mails";
import { t } from "../i18n";
import { aiApi, parseBackendError } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import type { MailAiAction } from "../types/mailAi";
import type { AiMailInsight, AiRunStatus } from "../types/workspace";
import { chatTurnPair } from "./aiChatTurns";
import { isWailsDesktop } from "./storageHelpers";
import { useAiMailCache } from "./useAiMailCache";
import { useAiMailRequest, type AiMailRun } from "./useAiMailRequest";

function mapErrorToAiStatus(code: string, message: string): AiRunStatus {
  const low = `${code} ${message}`.toLowerCase();
  if (code === "ERR_AI_SENSITIVE_BLOCKED" || low.includes("sensitive"))
    return "disabled-sensitive";
  if (/invalid-key|401|403|api key/.test(low)) return "invalid-key";
  if (/quota|429/.test(low)) return "quota-exceeded";
  if (/unavailable|无法连接/.test(low)) return "unavailable";
  return "error";
}

export function useAiStore() {
  const [aiOpen, setAiOpen] = useState(false);
  const { insights, chats, loadCachedForMail, saveInsight, addTurns, clear } =
    useAiMailCache();

  const saveTurnPair = useCallback(
    (run: AiMailRun, answer: string) => {
      addTurns(run.mailId, chatTurnPair(run, answer));
    },
    [addTurns],
  );

  const {
    result,
    dismissStatus,
    sensitive,
    markFailure,
    pending,
    getActive,
    begin,
    settle,
    stopGeneration,
    resetRequest,
  } = useAiMailRequest(saveTurnPair);

  const dispatch = useCallback(
    (
      mailId: string,
      action: MailAiAction,
      confirmed: boolean,
      auto = false,
    ) => {
      const run = begin(mailId, action, auto);
      if (!run) return;

      const fail = (err: unknown) => {
        const parsed = parseBackendError(err);
        settle(
          run,
          mapErrorToAiStatus(parsed.code, parsed.message),
          parsed.message,
        );
      };
      if (!isWailsDesktop()) {
        const timer = window.setTimeout(() => {
          if (settle(run, "idle"))
            saveTurnPair(run, t("ai.previewAnalyzedReply"));
        }, 450);
        run.cancel = () => window.clearTimeout(timer);
      } else if (action.kind !== "chat") {
        const base = {
          requestId: run.requestId,
          sourceLanguage: action.sourceLanguage,
        };
        const request =
          action.kind === "summary"
            ? aiApi.summarizeMail(
                mailId,
                confirmed,
                Boolean(action.forceRefresh),
                {
                  ...base,
                  autoTriggered: auto,
                },
              )
            : aiApi.generateReplyDraft(mailId, confirmed, {
                ...base,
                targetLanguage: action.targetLanguage,
                tone: action.tone,
              });
        run.cancel = () => void request.cancel().catch(() => undefined);
        void request
          .then((insight) => {
            if (settle(run, "idle")) saveInsight(mailId, insight);
          })
          .catch(fail);
      } else {
        run.cancel = () =>
          void aiApi.cancelRequest(run.requestId).catch(() => undefined);
        void aiApi
          .askMailStream({
            requestId: run.requestId,
            mailId,
            question: action.question,
            consentConfirmed: confirmed,
          })
          .then(() => {
            if (!getActive(run.requestId, mailId)) run.cancel?.();
          })
          .catch(fail);
      }
    },
    [begin, getActive, saveInsight, saveTurnPair, settle],
  );

  const runAction = useCallback(
    (mailId: string, action: MailAiAction, confirmed: boolean) =>
      dispatch(mailId, action, confirmed),
    [dispatch],
  );
  const autoSummarize = useCallback(
    (mailId: string, source: SourceLanguage) =>
      dispatch(mailId, summaryAction(source), false, true),
    [dispatch],
  );
  const onCacheReadFailure = useCallback(
    (mailId: string, err: unknown) => {
      const { code, message } = parseBackendError(err);
      markFailure(mailId, mapErrorToAiStatus(code, message));
    },
    [markFailure],
  );

  const reset = useCallback(() => {
    resetRequest();
    clear();
    setAiOpen(false);
  }, [clear, resetRequest]);

  function getInsight(mail: MailItem | null): AiMailInsight | null {
    if (!mail) return null;
    if (!isWailsDesktop()) return AI_INSIGHTS_BY_MAIL[mail.id] ?? null;
    return insights[mail.id] ?? null;
  }

  function getChats(mailId?: string) {
    if (!mailId) return [];
    const saved = chats[mailId] ?? [];
    return pending?.mailId === mailId
      ? [...saved, ...chatTurnPair(pending, pending.answer)]
      : saved;
  }

  return {
    aiOpen,
    setAiOpen,
    result,
    dismissStatus,
    sensitive,
    pendingMailId: pending?.mailId,
    pendingRequestId: pending?.requestId,
    loadCachedForMail,
    onCacheReadFailure,
    getInsight,
    hasMailSummary: (mail: Pick<MailItem, "id" | "aiSummarized">) =>
      Boolean(mail.aiSummarized || hasUsableSummary(insights[mail.id])),
    getChats,
    runAction,
    autoSummarize,
    stopGeneration,
    reset,
  };
}
