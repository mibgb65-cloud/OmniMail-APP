import { useCallback, useRef, useState } from "react";
import { aiApi } from "../services/backendClient";
import type { AiChatTurn, AiMailInsight } from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";

export function useAiMailCache() {
  const [insights, setInsights] = useState<Record<string, AiMailInsight>>({});
  const [chats, setChats] = useState<Record<string, AiChatTurn[]>>({});
  const reads = useRef(new Map<string, object>());

  const loadCachedForMail = useCallback((mailId: string) => {
    if (!isWailsDesktop() || !mailId) return;
    const ticket = {};
    reads.current.set(mailId, ticket);
    void aiApi
      .getCachedInsight(mailId)
      .then(({ insight, turns }) => {
        if (reads.current.get(mailId) !== ticket) return;
        if (insight) setInsights((prev) => ({ ...prev, [mailId]: insight }));
        setChats((prev) => ({ ...prev, [mailId]: turns }));
      })
      .catch(() => undefined);
  }, []);

  const saveInsight = useCallback(
    (mailId: string, insight: AiMailInsight) => {
      setInsights((prev) => ({ ...prev, [mailId]: insight }));
      loadCachedForMail(mailId);
    },
    [loadCachedForMail],
  );

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
      loadCachedForMail(mailId);
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
