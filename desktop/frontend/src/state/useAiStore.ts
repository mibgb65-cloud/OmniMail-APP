import { useCallback, useState } from "react";
import { parseAnalysisPrompt } from "../components/ai/aiAnalysisPrompt";
import { AI_INSIGHTS_BY_MAIL, DEFAULT_AI_INSIGHT } from "../data/mails";
import { aiApi, parseBackendError } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import type {
  AiChatTurn,
  AiMailInsight,
  AiRunStatus,
} from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";
import { useAiMailCache } from "./useAiMailCache";
import { useAiMailRequest, type AiMailRun } from "./useAiMailRequest";

const EMPTY_DESKTOP_INSIGHT: AiMailInsight = {
  summaryTitle: "尚未生成本封邮件摘要",
  summary: "点击「总结当前邮件」或右上角刷新按钮后才调用所选模型。",
  deadlines: [],
  draftTag: "待生成",
  draftReply: "",
};

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
      addTurns(run.mailId, [
        {
          id: `${run.requestId}-user`,
          role: "user",
          content: run.question,
          timestamp: "刚刚",
        },
        {
          id: `${run.requestId}-assistant`,
          role: "assistant",
          content: answer,
          timestamp: "刚刚",
        },
      ]);
    },
    [addTurns],
  );

  const {
    aiStatus,
    setAiStatus,
    errorDetail,
    pending,
    getActive,
    begin,
    settle,
    stopGeneration,
    resetRequest,
  } = useAiMailRequest(saveTurnPair);

  const runPrompt = useCallback(
    (mail: MailItem, prompt: string, confirmed: boolean) => {
      const options = parseAnalysisPrompt(prompt);
      const kind = !isWailsDesktop() ? "demo" : options ? "analysis" : "chat";
      const run = begin(mail.id, kind, prompt);
      if (!run) return;

      const fail = (err: unknown) => {
        const parsed = parseBackendError(err);
        settle(
          run,
          mapErrorToAiStatus(parsed.code, parsed.message),
          parsed.message,
        );
      };
      if (kind === "demo") {
        window.setTimeout(() => {
          if (settle(run, "idle"))
            saveTurnPair(run, `已基于《${mail.subject}》正文分析完成。`);
        }, 450);
      } else if (options) {
        void aiApi
          .analyzeMail(mail.id, confirmed, options)
          .then((insight) => {
            if (settle(run, "idle")) saveInsight(mail.id, insight);
          })
          .catch(fail);
      } else {
        void aiApi
          .askMailStream({
            requestId: run.requestId,
            mailId: mail.id,
            question: prompt,
            consentConfirmed: confirmed,
          })
          .then(() => {
            if (!getActive(run.requestId, run.mailId))
              void aiApi.cancelRequest(run.requestId).catch(() => undefined);
          })
          .catch(fail);
      }
    },
    [begin, getActive, saveInsight, saveTurnPair, settle],
  );

  const reset = useCallback(() => {
    resetRequest();
    clear();
    setAiOpen(false);
  }, [clear, resetRequest]);

  function getInsight(mail: MailItem | null) {
    if (mail && insights[mail.id]) return insights[mail.id];
    if (!isWailsDesktop())
      return (mail && AI_INSIGHTS_BY_MAIL[mail.id]) || DEFAULT_AI_INSIGHT;
    return EMPTY_DESKTOP_INSIGHT;
  }

  function getChats(mailId?: string): AiChatTurn[] {
    if (!mailId) return [];
    const saved = chats[mailId] ?? [];
    if (pending?.mailId !== mailId) return saved;
    const turns: AiChatTurn[] = [
      ...saved,
      {
        id: `${pending.requestId}-user`,
        role: "user",
        content: pending.question,
        timestamp: "刚刚",
      },
    ];
    if (pending.answer)
      turns.push({
        id: `${pending.requestId}-assistant`,
        role: "assistant",
        content: pending.answer,
        timestamp: "刚刚",
      });
    return turns;
  }

  return {
    aiOpen,
    setAiOpen,
    aiStatus,
    setAiStatus,
    errorDetail,
    canStop: pending !== null,
    pendingMailId: pending?.mailId,
    pendingRequestId: pending?.requestId,
    loadCachedForMail,
    getInsight,
    hasMailSummary: (mail: Pick<MailItem, "id" | "aiSummarized">) =>
      Boolean(mail.aiSummarized || insights[mail.id]?.summary.trim()),
    getChats,
    runPrompt,
    stopGeneration,
    reset,
  };
}
