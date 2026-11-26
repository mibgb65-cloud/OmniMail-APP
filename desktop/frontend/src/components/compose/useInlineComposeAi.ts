import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { aiApi, parseBackendError } from "../../services/backendClient";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { ComposeDraftState } from "../../types/settings";
import {
  createInlineAiSessionTracker,
  type InlineAiPresetId,
  type InlineAiRunRecord,
} from "./composeInlineAiLogic";
import {
  EMPTY_AI_STATE,
  useInlineComposeAiEvents,
  type AiComposeState,
} from "./useInlineComposeAiEvents";

export type InlineComposeAiController = ReturnType<typeof useInlineComposeAi>;

export function useInlineComposeAi(
  draft: ComposeDraftState | null,
  onOpenAiSettings: () => void,
  pushToast: (n: {
    tone: "info" | "success" | "warning" | "danger";
    title: string;
    detail?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => void,
) {
  const scopeKey =
    draft && !draft.minimized && draft.inlineAiOpen ? draft.id : "";
  const [raw, setRaw] = useState<AiComposeState>(EMPTY_AI_STATE);
  const state = raw.scopeKey === scopeKey ? raw : EMPTY_AI_STATE;

  const trackerRef = useRef<ReturnType<
    typeof createInlineAiSessionTracker
  > | null>(null);
  const scopeRef = useRef(scopeKey);
  const getTracker = useCallback(() => {
    if (!trackerRef.current) {
      trackerRef.current = createInlineAiSessionTracker((id) => {
        void aiApi.cancelRequest(id).catch(() => undefined);
      });
    }
    return trackerRef.current;
  }, []);

  useEffect(() => {
    scopeRef.current = scopeKey;
    return () => {
      getTracker().stopCurrent();
    };
  }, [getTracker, scopeKey]);

  const stopAssist = useCallback(() => {
    getTracker().stopCurrent();
    setRaw((prev) =>
      prev.scopeKey === scopeRef.current
        ? { ...prev, busy: false, stopped: prev.preview.trim().length > 0 }
        : prev,
    );
  }, [getTracker]);

  const clearPreview = useCallback(() => {
    getTracker().stopCurrent();
    setRaw((prev) =>
      prev.scopeKey === scopeRef.current
        ? { ...prev, preview: "", busy: false, stopped: false }
        : prev,
    );
  }, [getTracker]);

  useInlineComposeAiEvents({
    busy: state.busy,
    scopeKey,
    scopeRef,
    getTracker,
    setRaw,
    stopAssist,
    pushToast,
  });

  const runAssist = useCallback(
    (
      action: string,
      tone: string,
      customPrompt = "",
      presetId: InlineAiPresetId = customPrompt ? "custom" : "draft",
      bodyOverride?: string,
    ) => {
      if (!draft || !scopeKey) return;
      const sourceBody = bodyOverride ?? (state.preview.trim() || draft.body);
      const lastRun: InlineAiRunRecord = {
        presetId,
        action,
        tone,
        prompt: customPrompt,
        sourceBody,
      };
      if (!isWailsDesktop()) {
        const demoText = t("compose.demoPreviewText", {
          subject: draft.subject || t("compose.demoFallbackSubject"),
        });
        setRaw({
          scopeKey,
          preview: demoText,
          busy: false,
          stopped: false,
          activePreset: presetId,
          lastRun,
        });
        return;
      }
      const tracker = getTracker();
      const seq = tracker.startRun(scopeKey);
      setRaw({
        scopeKey,
        preview: "",
        busy: true,
        stopped: false,
        activePreset: presetId,
        lastRun,
      });
      void aiApi
        .assistComposeStream({
          draftId: draft.id,
          action,
          tone,
          subject: draft.subject,
          body: sourceBody,
          prompt: customPrompt,
          consentConfirmed: true,
        })
        .then((id) => tracker.bindRequestId(seq, id))
        .catch((err) => {
          if (!tracker.isRunCurrent(seq)) return;
          tracker.stopCurrent();
          setRaw((prev) =>
            prev.scopeKey === scopeKey ? { ...prev, busy: false } : prev,
          );
          const parsed = parseBackendError(err);
          const needCfg = parsed.code === "ERR_AI_DISABLED";
          pushToast({
            tone: "warning",
            title: parsed.message,
            actionLabel: needCfg ? t("compose.goConfigureAi") : undefined,
            onAction: needCfg ? onOpenAiSettings : undefined,
          });
        });
    },
    [draft, getTracker, onOpenAiSettings, pushToast, scopeKey, state.preview],
  );

  const regenerate = useCallback(() => {
    if (!state.lastRun || state.busy) return;
    const r = state.lastRun;
    runAssist(r.action, r.tone, r.prompt, r.presetId, r.sourceBody);
  }, [runAssist, state.busy, state.lastRun]);

  return {
    preview: state.preview,
    busy: state.busy,
    stopped: state.stopped,
    activePreset: state.activePreset,
    canRegenerate: Boolean(state.lastRun),
    runAssist,
    regenerate,
    stopAssist,
    clearPreview,
  };
}
