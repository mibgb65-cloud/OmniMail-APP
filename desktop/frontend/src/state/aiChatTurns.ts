import type { AiChatTurn } from "../types/workspace";
import type { AiMailRun } from "./useAiMailRequest";

export function chatTurnPair(run: AiMailRun, answer: string): AiChatTurn[] {
  if (run.action.kind !== "chat") return [];
  const user: AiChatTurn = {
    id: `${run.requestId}-user`,
    role: "user",
    content: run.action.question,
    timestamp: "刚刚",
  };
  return answer
    ? [
        user,
        {
          id: `${run.requestId}-assistant`,
          role: "assistant",
          content: answer,
          timestamp: "刚刚",
        },
      ]
    : [user];
}
