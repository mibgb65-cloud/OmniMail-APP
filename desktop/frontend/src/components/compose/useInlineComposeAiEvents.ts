import { Events } from "@wailsio/runtime";
import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { t } from "../../i18n";
import { isWailsDesktop } from "../../state/storageHelpers";
import {
  createInlineAiSessionTracker,
  type InlineAiPresetId,
  type InlineAiRunRecord,
} from "./composeInlineAiLogic";

export interface AiComposeState {
  scopeKey: string;
  preview: string;
  busy: boolean;
  stopped: boolean;
  activePreset: InlineAiPresetId | null;
  lastRun: InlineAiRunRecord | null;
}

export const EMPTY_AI_STATE: AiComposeState = {
  scopeKey: "",
  preview: "",
  busy: false,
  stopped: false,
  activePreset: null,
  lastRun: null,
};

export function useInlineComposeAiEvents(opts: {
  busy: boolean;
  scopeKey: string;
  scopeRef: RefObject<string>;
  getTracker: () => ReturnType<typeof createInlineAiSessionTracker>;
  setRaw: Dispatch<SetStateAction<AiComposeState>>;
  stopAssist: () => void;
  pushToast: (n: {
    tone: "info" | "success" | "warning" | "danger";
    title: string;
    detail?: string;
  }) => void;
}) {
  const {
    busy,
    scopeKey,
    scopeRef,
    getTracker,
    setRaw,
    stopAssist,
    pushToast,
  } = opts;

  useEffect(() => {
    if (!busy || !scopeKey || !isWailsDesktop()) return;
    const tracker = getTracker();
    const offs = [
      Events.On("omnimail:ai:chunk", (ev) => {
        const d = ev.data as { requestId?: string; delta?: string } | undefined;
        if (!d?.delta || !tracker.acceptEvent(d.requestId, scopeRef.current)) {
          return;
        }
        setRaw((prev) =>
          prev.scopeKey === scopeRef.current
            ? { ...prev, preview: prev.preview + d.delta }
            : prev,
        );
      }),
      Events.On("omnimail:ai:done", (ev) => {
        const d = ev.data as
          { requestId?: string; fullText?: string } | undefined;
        if (
          !d?.requestId ||
          !tracker.acceptEvent(d.requestId, scopeRef.current)
        ) {
          return;
        }
        tracker.finishByEvent(d.requestId);
        setRaw((prev) =>
          prev.scopeKey === scopeRef.current
            ? {
                ...prev,
                preview: d.fullText || prev.preview,
                busy: false,
                stopped: false,
              }
            : prev,
        );
      }),
      Events.On("omnimail:ai:error", (ev) => {
        const d = ev.data as
          { requestId?: string; message?: string } | undefined;
        if (
          !d?.requestId ||
          !tracker.acceptEvent(d.requestId, scopeRef.current)
        ) {
          return;
        }
        tracker.finishByEvent(d.requestId);
        setRaw((prev) =>
          prev.scopeKey === scopeRef.current ? { ...prev, busy: false } : prev,
        );
        pushToast({
          tone: "warning",
          title: t("toasts.aiComposeInterrupted"),
          detail: d.message,
        });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [busy, getTracker, pushToast, scopeKey, scopeRef, setRaw]);

  useEffect(() => {
    if (!busy) return;
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        stopAssist();
      }
    };
    window.addEventListener("keydown", onKeyCapture, true);
    return () => window.removeEventListener("keydown", onKeyCapture, true);
  }, [busy, stopAssist]);
}
