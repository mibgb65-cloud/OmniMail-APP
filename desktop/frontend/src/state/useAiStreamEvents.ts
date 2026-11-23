import { Events } from "@wailsio/runtime";
import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { AiChatTurn, AiRunStatus } from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";

export function useAiStreamEvents(
  activeReqRef: MutableRefObject<{ reqId: string; mailId: string } | null>,
  setChatsByMail: Dispatch<SetStateAction<Record<string, AiChatTurn[]>>>,
  setAiStatus: Dispatch<SetStateAction<AiRunStatus>>,
) {
  useEffect(() => {
    if (!isWailsDesktop()) return;
    const offs = [
      Events.On("omnimail:ai:chunk", (ev) => {
        const d = ev.data as
          { requestId?: string; mailId?: string; delta?: string } | undefined;
        if (!d?.requestId || d.requestId !== activeReqRef.current?.reqId)
          return;
        const mid = d.mailId || activeReqRef.current.mailId;
        setChatsByMail((prev) => {
          const turns = [...(prev[mid] ?? [])];
          const last = turns[turns.length - 1];
          if (last && last.role === "assistant") {
            turns[turns.length - 1] = {
              ...last,
              content: last.content + (d.delta ?? ""),
            };
          } else {
            turns.push({
              id: `a-${Date.now()}`,
              role: "assistant",
              content: d.delta ?? "",
              timestamp: "刚刚",
            });
          }
          return { ...prev, [mid]: turns };
        });
      }),
      Events.On("omnimail:ai:done", (ev) => {
        const d = ev.data as { requestId?: string } | undefined;
        if (d?.requestId === activeReqRef.current?.reqId) {
          activeReqRef.current = null;
          setAiStatus("idle");
        }
      }),
      Events.On("omnimail:ai:error", (ev) => {
        const d = ev.data as
          { requestId?: string; runStatus?: string } | undefined;
        if (d && d.requestId === activeReqRef.current?.reqId) {
          activeReqRef.current = null;
          setAiStatus((d.runStatus as AiRunStatus) || "error");
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [activeReqRef, setAiStatus, setChatsByMail]);
}
