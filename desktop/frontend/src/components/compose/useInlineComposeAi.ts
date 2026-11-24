import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { t } from "../../i18n";
import { aiApi, parseBackendError } from "../../services/backendClient";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { ComposeDraftState } from "../../types/settings";

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
  const [reqId, setReqId] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reqId || !isWailsDesktop()) return;
    const offs = [
      Events.On("omnimail:ai:chunk", (ev) => {
        const d = ev.data as { requestId?: string; delta?: string } | undefined;
        if (d?.requestId === reqId && d.delta) setPreview((p) => p + d.delta);
      }),
      Events.On("omnimail:ai:done", (ev) => {
        const d = ev.data as
          { requestId?: string; fullText?: string } | undefined;
        if (d?.requestId === reqId) {
          if (d.fullText) setPreview(d.fullText);
          setBusy(false);
          setReqId("");
        }
      }),
      Events.On("omnimail:ai:error", (ev) => {
        const d = ev.data as
          { requestId?: string; message?: string } | undefined;
        if (d?.requestId === reqId) {
          setBusy(false);
          setReqId("");
          pushToast({
            tone: "warning",
            title: t("toasts.aiComposeInterrupted"),
            detail: d.message,
          });
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [reqId, pushToast]);

  const runAssist = (action: string, tone: string, customPrompt = "") => {
    if (!draft) return;
    if (!isWailsDesktop()) {
      setPreview(
        t("compose.demoPreviewText", {
          subject: draft.subject || t("compose.demoFallbackSubject"),
        }),
      );
      return;
    }
    setPreview("");
    setBusy(true);
    void aiApi
      .assistComposeStream({
        draftId: draft.id,
        action,
        tone,
        subject: draft.subject,
        body: draft.body,
        prompt: customPrompt,
        consentConfirmed: true,
      })
      .then((id) => setReqId(id))
      .catch((err) => {
        setBusy(false);
        const parsed = parseBackendError(err);
        pushToast({
          tone: "warning",
          title: parsed.message,
          actionLabel:
            parsed.code === "ERR_AI_DISABLED"
              ? t("compose.goConfigureAi")
              : undefined,
          onAction:
            parsed.code === "ERR_AI_DISABLED" ? onOpenAiSettings : undefined,
        });
      });
  };

  const stopAssist = () => {
    if (reqId) void aiApi.cancelRequest(reqId);
    setBusy(false);
    setReqId("");
  };

  return { reqId, preview, setPreview, busy, runAssist, stopAssist };
}
