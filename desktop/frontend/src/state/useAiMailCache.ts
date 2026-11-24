import { useCallback, useRef, useState } from "react";
import { aiApi } from "../services/backendClient";
import type { AiChatTurn, AiMailInsight } from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";

export function useAiMailCache() {
  const [insights, setInsights] = useState<
    Partial<Record<string, AiMailInsight | null>>
  >({});
  const [chats, setChats] = useState<Record<string, AiChatTurn[]>>({});
  const reads = useRef(new Map<string, { superseded: boolean }>());

  const loadCachedForMail = useCallback(async (mailId: string) => {
    if (!isWailsDesktop() || !mailId) return undefined;
    const ticket = { superseded: false };
    reads.current.set(mailId, ticket);
    try {
      const { insight, turns } = await aiApi.getCachedInsight(mailId);
      if (reads.current.get(mailId) !== ticket) return undefined;
      setChats((prev) => ({ ...prev, [mailId]: turns }));
      if (ticket.superseded) return undefined;
      setInsights((prev) => ({ ...prev, [mailId]: insight }));
      return insight;
    } catch (err) {
      if (reads.current.get(mailId) === ticket && !ticket.superseded) throw err;
      return undefined;
    } finally {
      if (reads.current.get(mailId) === ticket) reads.current.delete(mailId);
    }
  }, []);

  const saveInsight = useCallback((mailId: string, insight: AiMailInsight) => {
    // 较早开始的读取仍能恢复历史问答，但不能覆盖刚写入的摘要或草稿。
    const read = reads.current.get(mailId);
    if (read) read.superseded = true;
    setInsights((prev) => ({ ...prev, [mailId]: insight }));
  }, []);

  const addTurns = useCallback(
    (mailId: string, turns: AiChatTurn[]) => {
      const ids = new Set(turns.map((turn) => turn.id));
      setChats((prev) => ({
        ...prev,
        [mailId]: [
          ...(prev[mailId] ?? []).filter((turn) => !ids.has(turn.id)),
          ...turns,
        ].slice(-20),
      }));
      // 重新读取数据库确认过的顺序，也补上窗口打开后尚未加载的历史。
      void loadCachedForMail(mailId).catch(() => undefined);
    },
    [loadCachedForMail],
  );

  const clear = useCallback(() => {
    reads.current.clear();
    setInsights({});
    setChats({});
  }, []);

  return { insights, chats, loadCachedForMail, saveInsight, addTurns, clear };
}
