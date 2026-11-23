import { useCallback, useRef, useState } from "react";
import { AI_INSIGHTS_BY_MAIL, DEFAULT_AI_INSIGHT } from "../data/mails";
import { aiApi, parseBackendError } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import type {
  AiChatTurn,
  AiMailInsight,
  AiRunStatus,
} from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";
import { useAiStreamEvents } from "./useAiStreamEvents";

const EMPTY_DESKTOP_INSIGHT: AiMailInsight = {
  summaryTitle: "尚未生成本封邮件摘要",
  summary:
    "遵循「零静默扫信」隐私原则，点击下方「总结当前邮件」或右上角刷新按钮后才调用所选模型。",
  deadlines: [],
  draftTag: "待生成",
  draftReply: "",
};

function mapErrorToAiStatus(rawErr: unknown): AiRunStatus {
  const parsed = parseBackendError(rawErr);
  const low = `${parsed.code} ${parsed.message}`.toLowerCase();
  if (parsed.code === "ERR_AI_SENSITIVE_BLOCKED" || low.includes("sensitive"))
    return "disabled-sensitive";
  if (
    low.includes("invalid-key") ||
    low.includes("401") ||
    low.includes("403") ||
    low.includes("api key")
  )
    return "invalid-key";
  if (low.includes("quota") || low.includes("429")) return "quota-exceeded";
  if (low.includes("unavailable") || low.includes("无法连接"))
    return "unavailable";
  return "error";
}

export function useAiStore() {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiRunStatus>("idle");
  const [insightsByMail, setInsightsByMail] = useState<
    Record<string, AiMailInsight>
  >({});
  const [chatsByMail, setChatsByMail] = useState<Record<string, AiChatTurn[]>>(
    {},
  );
  const activeReqRef = useRef<{ reqId: string; mailId: string } | null>(null);

  useAiStreamEvents(activeReqRef, setChatsByMail, setAiStatus);

  const loadCachedForMail = useCallback((mailId: string) => {
    if (!isWailsDesktop() || !mailId) return;
    void aiApi
      .getCachedInsight(mailId)
      .then(({ insight, turns }) => {
        if (insight)
          setInsightsByMail((prev) => ({ ...prev, [mailId]: insight }));
        if (turns.length > 0)
          setChatsByMail((prev) => ({ ...prev, [mailId]: turns }));
      })
      .catch(() => undefined);
  }, []);

  const getInsight = useCallback(
    (mail: MailItem | null): AiMailInsight => {
      if (!mail)
        return isWailsDesktop() ? EMPTY_DESKTOP_INSIGHT : DEFAULT_AI_INSIGHT;
      if (insightsByMail[mail.id]) return insightsByMail[mail.id];
      if (!isWailsDesktop())
        return AI_INSIGHTS_BY_MAIL[mail.id] ?? DEFAULT_AI_INSIGHT;
      return EMPTY_DESKTOP_INSIGHT;
    },
    [insightsByMail],
  );

  const runPrompt = useCallback(
    (mail: MailItem, prompt: string) => {
      setAiStatus("processing");
      if (!isWailsDesktop()) {
        const userTurn: AiChatTurn = {
          id: `u-${Date.now()}`,
          role: "user",
          content: prompt,
          timestamp: "刚刚",
        };
        setChatsByMail((prev) => ({
          ...prev,
          [mail.id]: [...(prev[mail.id] ?? []), userTurn],
        }));
        window.setTimeout(() => {
          setChatsByMail((prev) => ({
            ...prev,
            [mail.id]: [
              ...(prev[mail.id] ?? []),
              {
                id: `a-${Date.now()}`,
                role: "assistant",
                content: `已基于《${mail.subject}》正文分析完成。`,
                timestamp: "刚刚",
              },
            ],
          }));
          setAiStatus("idle");
        }, 450);
        return;
      }

      if (prompt.includes("重新生成摘要") || prompt === "__ANALYZE__") {
        void aiApi
          .analyzeMail(mail.id, true, prompt !== "__ANALYZE__")
          .then((ins) => {
            setInsightsByMail((prev) => ({ ...prev, [mail.id]: ins }));
            setAiStatus("idle");
          })
          .catch((err) => setAiStatus(mapErrorToAiStatus(err)));
        return;
      }

      const history = chatsByMail[mail.id] ?? [];
      const userTurn: AiChatTurn = {
        id: `u-${Date.now()}`,
        role: "user",
        content: prompt,
        timestamp: "刚刚",
      };
      setChatsByMail((prev) => ({
        ...prev,
        [mail.id]: [...history, userTurn],
      }));
      void aiApi
        .askMailStream({
          mailId: mail.id,
          question: prompt,
          history,
          consentConfirmed: true,
        })
        .then((reqId) => {
          activeReqRef.current = { reqId, mailId: mail.id };
        })
        .catch((err) => setAiStatus(mapErrorToAiStatus(err)));
    },
    [chatsByMail],
  );

  const stopGeneration = useCallback(() => {
    if (activeReqRef.current?.reqId) {
      void aiApi.cancelRequest(activeReqRef.current.reqId);
      activeReqRef.current = null;
    }
    setAiStatus("idle");
  }, []);

  return {
    aiOpen,
    setAiOpen,
    aiStatus,
    setAiStatus,
    chatsByMail,
    loadCachedForMail,
    getInsight,
    runPrompt,
    stopGeneration,
  };
}
