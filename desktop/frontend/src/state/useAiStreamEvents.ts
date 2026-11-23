import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import type { AiRunStatus } from "../types/workspace";
import { isWailsDesktop } from "./storageHelpers";

interface EventIdentity {
  requestId: string;
  mailId?: string;
}

export type AiStreamChunk = EventIdentity & { delta: string };
export type AiStreamDone = EventIdentity & { fullText: string };
export type AiStreamError = EventIdentity & {
  runStatus: AiRunStatus;
  message: string;
};

type AiStreamHandlers = {
  onChunk: (event: AiStreamChunk) => void;
  onDone: (event: AiStreamDone) => void;
  onError: (event: AiStreamError) => void;
};

export function useAiStreamEvents({
  onChunk,
  onDone,
  onError,
}: AiStreamHandlers) {
  useEffect(() => {
    if (!isWailsDesktop()) return;
    const offs = [
      Events.On("omnimail:ai:chunk", (ev) => {
        if (ev.data) onChunk(ev.data as Parameters<typeof onChunk>[0]);
      }),
      Events.On("omnimail:ai:done", (ev) => {
        if (ev.data) onDone(ev.data as Parameters<typeof onDone>[0]);
      }),
      Events.On("omnimail:ai:error", (ev) => {
        if (ev.data) onError(ev.data as Parameters<typeof onError>[0]);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [onChunk, onDone, onError]);
}
