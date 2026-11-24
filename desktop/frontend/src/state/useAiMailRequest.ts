import { useCallback, useRef, useState } from "react";
import type { MailAiAction } from "../types/mailAi";
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
  action: MailAiAction;
  autoTriggered: boolean;
  cancel?: () => void;
}

const idle = { status: "idle" as const, detail: "" };

export function useAiMailRequest(
  saveTurnPair: (run: AiMailRun, answer: string) => void,
) {
  const [result, setResult] = useState<{
    run?: AiMailRun;
    status: AiRunStatus;
    detail: string;
  }>(idle);
  const [sensitive, setSensitive] = useState<ReadonlySet<string>>(new Set());
  const failed = useRef(new Set<string>());
  const [pending, setPending] = useState<
    (AiMailRun & { answer: string }) | null
  >(null);
  const active = useRef<AiMailRun | null>(null);

  const markFailure = useCallback((mailId: string, status: AiRunStatus) => {
    failed.current.add(mailId);
    if (status === "disabled-sensitive")
      setSensitive((prev) => new Set(prev).add(mailId));
  }, []);

  const settle = useCallback(
    (run: AiMailRun, status: AiRunStatus, detail = "") => {
      if (active.current !== run) return false;
      active.current = null;
      setPending(null);
      if (status !== "idle") markFailure(run.mailId, status);
      setResult(status === "idle" ? idle : { run, status, detail });
      return true;
    },
    [markFailure],
  );

  const begin = useCallback(
    (mailId: string, action: MailAiAction, autoTriggered: boolean) => {
      if (active.current || (autoTriggered && failed.current.has(mailId)))
        return null;
      // 在 IPC 调用前登记 ID，避免快速模型的第一段/完成事件先于 IPC 返回。
      const run: AiMailRun = {
        requestId: `aireq-${window.crypto.randomUUID()}`,
        mailId,
        action,
        autoTriggered,
      };
      active.current = run;
      setResult({ run, status: "processing", detail: "" });
      if (action.kind === "chat") setPending({ ...run, answer: "" });
      return run;
    },
    [],
  );

  const getActive = useCallback(
    (requestId: string, mailId: string | undefined) => {
      const run = active.current;
      return run?.action.kind === "chat" &&
        run.requestId === requestId &&
        run.mailId === mailId
        ? run
        : null;
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

  const stopGeneration = useCallback(
    (mailId?: string, onlyAuto = false) => {
      const run = active.current;
      if (
        !run ||
        (mailId && mailId !== run.mailId) ||
        (onlyAuto && !run.autoTriggered)
      )
        return;
      settle(run, "idle");
      run.cancel?.();
    },
    [settle],
  );

  const resetRequest = useCallback(() => {
    stopGeneration();
    failed.current.clear();
    setSensitive(new Set());
    setResult(idle);
  }, [stopGeneration]);

  return {
    result,
    dismissStatus: () => setResult(idle),
    sensitive,
    markFailure,
    pending,
    getActive,
    begin,
    settle,
    stopGeneration,
    resetRequest,
  };
}
