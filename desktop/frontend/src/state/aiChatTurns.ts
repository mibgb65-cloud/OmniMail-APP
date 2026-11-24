import { formatLocalizedTime, getCurrentLanguage } from "../i18n";
import type { AiChatTurn } from "../types/workspace";
import type { AiMailRun } from "./useAiMailRequest";

export function chatTurnPair(run: AiMailRun, answer: string): AiChatTurn[] {
  if (run.action.kind !== "chat") return [];
  const nowLabel = formatLocalizedTime("刚刚", getCurrentLanguage());
  const user: AiChatTurn = {
    id: `${run.requestId}-user`,
    role: "user",
    content: run.action.question,
    timestamp: nowLabel,
  };
  return answer
    ? [
        user,
        {
          id: `${run.requestId}-assistant`,
          role: "assistant",
          content: answer,
          timestamp: nowLabel,
        },
      ]
    : [user];
}
