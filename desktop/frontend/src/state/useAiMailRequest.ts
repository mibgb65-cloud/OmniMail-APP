import { useCallback, useRef, useState } from "react";
import { aiApi } from "../services/backendClient";
import type { AiRunStatus } from "../types/workspace";
import {
  useAiStreamEvents,
  type AiStreamChunk,
  type AiStreamDone,
  type AiStreamError,
} from "./useAiStreamEvents";

export interface AiMailRun {
  requestId: string;
  mailId: string;
  kind: "analysis" | "chat" | "demo";
  question: string;
}

export function useAiMailRequest(
  saveTurnPair: (run: AiMailRun, answer: string) => void,
) {
  const [aiStatus, setAiStatus] = useState<AiRunStatus>("idle");
  const [errorDetail, setErrorDetail] = useState("");
  const [pending, setPending] = useState<
    (AiMailRun & { answer: string }) | null
  >(null);
  const active = useRef<AiMailRun | null>(null);

  const settle = useCallback(
    (run: AiMailRun, status: AiRunStatus, detail = "") => {
      if (active.current !== run) return false;
      active.current = null;
      setPending(null);
      setAiStatus(status);
      setErrorDetail(detail);
      return true;
    },
    [],
  );

  const begin = useCallback(
    (mailId: string, kind: AiMailRun["kind"], question: string) => {
      if (active.current) return null;
      // 在 IPC 调用前登记 ID，避免快速模型的第一段/完成事件先于 IPC 返回。
      const run: AiMailRun = {
        requestId: `aireq-${window.crypto.randomUUID()}`,
        mailId,
        kind,
        question,
      };
      active.current = run;
      setAiStatus("processing");
      setErrorDetail("");
      if (kind === "chat") setPending({ ...run, answer: "" });
      return run;
    },
    [],
  );

  const getActive = useCallback(
    (requestId: string, mailId: string | undefined) => {
      const run = active.current;
      return run?.requestId === requestId && run.mailId === mailId ? run : null;
    },
    [],
  );

  const onChunk = useCallback(
    ({ requestId, mailId, delta }: AiStreamChunk) => {
      if (!getActive(requestId, mailId)) return;
      setPending((prev) =>
        prev?.requestId === requestId
          ? { ...prev, answer: prev.answer + delta }
          : prev,
      );
    },
    [getActive],
  );

  const onDone = useCallback(
    ({ requestId, mailId, fullText }: AiStreamDone) => {
      const run = getActive(requestId, mailId);
      if (run && settle(run, "idle")) saveTurnPair(run, fullText);
    },
    [getActive, saveTurnPair, settle],
  );

  const onError = useCallback(
    ({ requestId, mailId, runStatus, message }: AiStreamError) => {
      const run = getActive(requestId, mailId);
      if (run) settle(run, runStatus || "error", message);
    },
    [getActive, settle],
  );

  useAiStreamEvents({ onChunk, onDone, onError });

  const stopGeneration = useCallback(() => {
    const run = active.current;
    if (!run || run.kind === "analysis") return;
    settle(run, "idle");
    if (run.kind === "chat")
      void aiApi.cancelRequest(run.requestId).catch(() => undefined);
  }, [settle]);

  const resetRequest = useCallback(() => {
    stopGeneration();
    const run = active.current;
    if (run) settle(run, "idle");
    setAiStatus("idle");
    setErrorDetail("");
  }, [settle, stopGeneration]);

  return {
    aiStatus,
    setAiStatus,
    errorDetail,
    pending,
    getActive,
    begin,
    settle,
    stopGeneration,
    resetRequest,
  };
}
